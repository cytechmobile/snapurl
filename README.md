# Cloudflare URL Shortener

A high-performance, privacy-conscious URL shortener implemented using Cloudflare Workers and Cloudflare KV. This project allows you to create custom short links that **redirect users to the original long URL**, all while providing options for detailed analytics.

## Features

* **Custom Short Links:** Create unique, memorable short URLs (e.g., `yourshort.link/my-project`).

* **URL Redirection:** The Worker sends an HTTP redirect (302 Found) to the user's browser, directing them to the original long URL.

* **Cloudflare KV Storage:** Leverages Cloudflare's Key-Value store for fast and globally distributed storage of URL mappings.

* **Analytics Integration:**

    * **Cloudflare Workers Analytics Engine:** Built-in integration for logging event data (short code accessed, country, user agent) for scalable, real-time analytics within the Cloudflare dashboard.

    * **Google Analytics 4 (GA4) Measurement Protocol:** Option to send detailed event data (including geographical information like country, region, and city) directly to your GA4 property for comprehensive tracking.

* **Privacy-Focused:** Utilizes random UUIDs for `client_id` when sending to GA4 to avoid directly tracking user IPs.

## Technologies Used

* **Cloudflare Workers:** Serverless execution environment at the edge.

* **Cloudflare KV:** Distributed key-value store for URL mappings.

* **Wrangler CLI:** Cloudflare's command-line tool for Workers development and deployment.

* **`nanoid`:** For generating short, unique IDs.

* **Google Analytics 4 (GA4) Measurement Protocol (Optional):** For external analytics.

## Setup and Deployment

### Prerequisites

1.  **Cloudflare Account:** An active Cloudflare account.

2.  **Domain:** A domain registered and managed by Cloudflare DNS. You'll typically use a subdomain (e.g., `s.yourdomain.com`) for your short links.

3.  **Node.js & npm/yarn:** Ensure you have Node.js installed on your local machine.

### Installation

1.  **Install Wrangler CLI:**

    ```bash
    npm install -g wrangler
    ```

2.  **Log in to Cloudflare via Wrangler:**

    ```bash
    wrangler login
    ```

    Follow the prompts to authenticate.

3.  **Create a new Worker project:**
    If you haven't already, create your project directory and initialize the Worker.

    ```bash
    wrangler init my-link-shortener
    cd my-link-shortener
    ```

    Choose the "Worker" template. Wrangler will generate `src/index.js` (or `.ts`) and `wrangler.jsonc` (or `.toml`).

4.  **Install `nanoid`:**

    ```bash
    npm install nanoid
    ```

### Cloudflare KV Namespace Setup

Create two KV namespaces: one for production and one for development/preview.

```bash
wrangler kv:namespace create SHORTENER_KV_PRODUCTION
wrangler kv:namespace create SHORTENER_KV_PREVIEW --preview

Important: Note the id values provided in the output for both namespaces. You will need them for wrangler.jsonc.

Configuration (wrangler.jsonc)

Open your wrangler.jsonc file (or wrangler.toml if you chose TOML) and update it.

Key changes to make:

    Remove the assets block: This ensures your Worker handles all requests and doesn't fall back to serving static files for the root path.

    Add KV Namespace Bindings: Use the id and preview_id from the previous step.

    Add Cloudflare Workers Analytics Engine Binding (Optional): If you want to use Cloudflare's built-in analytics.

Example wrangler.jsonc:
JSON

{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "racket-link-shortener",
  "main": "src/index.js",
  "compatibility_date": "2025-07-05",
  "compatibility_flags": [
    "nodejs_compat",
    "global_fetch_strictly_public"
  ],
  // REMOVE THE "assets" BLOCK ENTIRELY if it exists
  // "assets": {
  //   "directory": "./public"
  // },
  "observability": {
    "enabled": true
  },
  "kv_namespaces": [
    {
      "binding": "racket_shortener", // This is the name your Worker code will use (e.g., env.racket_shortener)
      "id": "YOUR_PRODUCTION_KV_NAMESPACE_ID",
      "preview_id": "YOUR_PREVIEW_KV_NAMESPACE_ID"
    }
  ],
  "analytics_engine_datasets": [ // Add this section for Cloudflare Analytics Engine
    {
      "binding": "ANALYTICS", // This is the binding name you'll use in your Worker code
      "dataset": "link_shortener_events" // This is the name of your dataset
    }
  ]
}

Replace YOUR_PRODUCTION_KV_NAMESPACE_ID and YOUR_PREVIEW_KV_NAMESPACE_ID with the actual IDs from your wrangler kv:namespace create output.

Google Analytics 4 (GA4) Setup (Optional)

If you want to send data to GA4:

    Get GA4 Measurement ID and API Secret:

        In your GA4 property, go to Admin > Data Streams > Web > Select your data stream.

        Copy your Measurement ID (e.g., G-XXXXXXXXXX).

        Under "Events", find "Measurement Protocol API secrets" and create a new secret, then copy the API Secret.

    Store GA4 Credentials as Secrets:
    Bash

    wrangler secret put GOOGLE_ANALYTICS_MEASUREMENT_ID
    # Paste your Measurement ID when prompted

    wrangler secret put GOOGLE_ANALYTICS_API_SECRET
    # Paste your API Secret when prompted

Worker Code (src/index.js)

Update your src/index.js file with the logic for redirection and logging analytics.
JavaScript

// src/index.js
import { nanoid } from 'nanoid';

export default {
  async fetch(request, env, event) {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- Handle POST requests to /create for generating new short links ---
    if (request.method === "POST" && path === "/create") {
      try {
        const { longUrl, customShortCode } = await request.json();

        if (!longUrl || !longUrl.startsWith("http")) {
          return new Response("Invalid URL provided. Must start with http:// or https://", { status: 400 });
        }

        let shortCode = customShortCode;
        if (!shortCode) {
          do {
            shortCode = nanoid(6);
          } while (await env.racket_shortener.get(shortCode));
        } else {
            if (await env.racket_shortener.get(shortCode)) {
                return new Response("Custom short code already in use", { status: 409 });
            }
        }

        await env.racket_shortener.put(shortCode, longUrl);

        const shortenedUrl = `${url.origin}/${shortCode}`;
        return new Response(JSON.stringify({ shortUrl: shortenedUrl }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      } catch (error) {
        console.error("Error creating short URL:", error);
        return new Response("Error creating short URL", { status: 500 });
      }
    }

    // --- Handle GET/other requests for URL redirection ---
    const shortCode = path.slice(1);

    if (shortCode === "") {
        return new Response("Welcome to the URL Shortener! Append a short code to the URL.", { status: 200 });
    }

    try {
      const longUrl = await env.racket_shortener.get(shortCode);

      if (longUrl) {
        // Log to Cloudflare Workers Analytics Engine (Optional)
        logCloudflareAnalytics(request, env, shortCode, longUrl);

        // Log to Google Analytics 4 Measurement Protocol (Optional)
        event.waitUntil(
          logGoogleAnalytics(request, env, shortCode, longUrl)
        );

        // Perform HTTP 302 Redirect
        return Response.redirect(longUrl, 302);
      } else {
        return new Response("Short URL not found", { status: 404 });
      }
    } catch (error) {
      console.error("Error redirecting request:", error);
      return new Response("Internal Server Error during redirection.", { status: 500 });
    }
  },
};

// Function to log data to Cloudflare Workers Analytics Engine
function logCloudflareAnalytics(request, env, shortCode, longUrl) {
  try {
    const country = request.cf?.country || 'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';

    env.ANALYTICS.writeDataPoint({
      blobs: [
        shortCode,   // blob1: The short code accessed
        country,     // blob2: Country of the user
        userAgent,   // blob3: User agent string
        longUrl      // blob4: The long URL that was redirected
      ],
      doubles: [
        1            // double1: A simple counter for each access
      ]
    });
    console.log(`Cloudflare Analytics event for '${shortCode}' sent.`);
  } catch (e) {
    console.error("Error sending to Cloudflare Analytics Engine:", e);
  }
}

// Function to log data to Google Analytics 4 Measurement Protocol
async function logGoogleAnalytics(request, env, shortCode, longUrl) {
  const measurementId = env.GOOGLE_ANALYTICS_MEASUREMENT_ID;
  const apiSecret = env.GOOGLE_ANALYTICS_API_SECRET;

  if (!measurementId || !apiSecret) {
    console.error("Missing Google Analytics credentials. Skipping GA4 logging.");
    return;
  }

  const clientId = crypto.randomUUID(); // Generate a random UUID for client_id
  const userAgent = request.headers.get('User-Agent') || 'unknown-user-agent';
  const countryCode = request.cf?.country || 'unknown';
  const regionCodeRaw = request.cf?.regionCode || '';
  const city = request.cf?.city || 'unknown';

  const regionId = (countryCode !== 'unknown' && regionCodeRaw !== '') ? `${countryCode}-${regionCodeRaw}` : 'unknown';

  const gaPayload = {
    client_id: clientId,
    events: [
      {
        name: "short_link_access",
        params: {
          link_short_code: shortCode,
          link_longUrl: longUrl,
          page_path: request.url,
          page_referrer: request.headers.get('Referer') || 'none',
          user_agent: userAgent,
          engagement_time_msec: 1,         // Number
          session_id: Date.now(),          // Number
          session_start: true,             // Boolean
          debug_mode: true                 // Set to 'true' for DebugView, remove for production
        },
      },
    ],
    user_location: {
      country_id: countryCode,
      region_id: regionId,
      city: city,
      continent_id: request.cf?.continent || 'unknown'
    }
  };

  try {
    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gaPayload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send GA4 event: ${response.status} - ${errorText}`);
    } else {
      console.log(`GA4 event for '${shortCode}' with client_id '${clientId}' sent successfully.`);
    }

  } catch (error) {
    console.error("Error sending GA4 event:", error);
  }
}

Deployment

    Deploy your Worker:
    Bash

    wrangler deploy

    This will deploy your Worker to Cloudflare, making it accessible via a workers.dev subdomain.

    Set up a Custom Domain (Optional but Recommended):
    To use your own short domain (e.g., s.yourdomain.com):

        Log in to your Cloudflare dashboard.

        Go to Workers & Pages > Select your Worker.

        Navigate to Settings > Triggers > Custom Domains.

        Click "Add Custom Domain" and enter your desired subdomain (e.g., url.racket.gr). Cloudflare will handle DNS and SSL.

Usage

Creating Short Links

Send a POST request to your Worker's /create endpoint with a JSON body:
Bash

curl -X POST \
  [https://url.racket.gr/create](https://url.racket.gr/create) \
  -H "Content-Type: application/json" \
  -d '{
    "longUrl": "[https://www.example.com/this-is-a-very-long-url-that-needs-shortening](https://www.example.com/this-is-a-very-long-url-that-needs-shortening)",
    "customShortCode": "mycustomlink"
  }'

    longUrl: The URL to shorten (required).

    customShortCode: (Optional) Your desired short code. If omitted, a random 6-character code will be generated.

Alternatively, you can manually add key-value pairs directly in your Cloudflare dashboard under Workers & Pages > KV > Your KV Namespace.

Accessing Short Links

Visit your short URL in a browser (e.g., https://url.racket.gr/mycustomlink). The Worker will redirect the user to the longUrl.

Analytics

Cloudflare Workers Analytics Engine

    View Metrics: Log in to your Cloudflare dashboard, go to Workers & Pages > Select your Worker > Observability tab. You'll find charts and data based on the writeDataPoint calls.

    Query Data: Use the Cloudflare GraphQL Analytics API to run custom queries against your link_shortener_events dataset for detailed insights.

Google Analytics 4 (GA4) Measurement Protocol

    Debug View: To verify events in real-time, ensure debug_mode: true is set in your Worker's GA4 payload (as shown in the src/index.js example). Then, go to GA4 Admin > DebugView. Look for your short_link_access events and check the "User Properties" panel on the right for Country, Region, and City data.

    Standard Reports: After 24-48 hours, your GA4 standard reports (e.g., Demographics > Geographic details) will show the aggregated location data. Remember to set up custom definitions for link_short_code and link_longUrl if you want them as dimensions in GA4 reports.

Contributing

If you'd like to contribute to this project, please refer to the LICENSE file for details.

License

This project is licensed under the GNU General Public License v3.0. See the LICENSE file for details.
