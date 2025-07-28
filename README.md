

# **Cloudflare URL Shortener**

A high-performance URL shortener implemented using Cloudflare Workers and Cloudflare KV. This project allows you to create custom short links that **redirect** users to the original long **URL**, all while providing options for detailed analytics.

## **Features**

* **Custom Short Links:** Create unique, memorable short URLs (e.g., yourshort.link/my-project).  
* **URL Redirection:** The Worker sends an HTTP redirect (302 Found) to the user's browser, directing them to the original long URL.  
* **Cloudflare KV Storage:** Leverages Cloudflare's Key-Value store for fast and globally distributed storage of URL mappings.  
* **Analytics Integration:**  
  * **Cloudflare Workers Analytics Engine:** Built-in integration for logging event data (short code accessed, country, user agent) for scalable, real-time analytics within the Cloudflare dashboard.  
  * **Google Analytics 4 (GA4) Measurement Protocol:** Option to send detailed event data (including geographical information like country, region, and city) directly to your GA4 property for comprehensive tracking.  

## **Technologies Used**

* **Cloudflare Workers:** Serverless execution environment at the edge.  
* **Cloudflare KV:** Distributed key-value store for URL mappings.  
* **Wrangler CLI:** Cloudflare's command-line tool for Workers development and deployment.  
* **nanoid:** For generating short, unique IDs (used by the TUI for auto-generated codes).  
* **Google Analytics 4 (GA4) Measurement Protocol (Optional):** For external analytics.

## **Setup and Deployment**

### **Prerequisites**

1. **Cloudflare Account:** An active Cloudflare account.  
2. **Domain:** A domain registered and managed by Cloudflare DNS. You'll typically use a subdomain (e.g., s.yourdomain.com) for your short links.  
3. **Node.js & npm/yarn:** Ensure you have Node.js installed on your local machine.

### **Installation**

1. **Install Wrangler CLI:**  
   ```Bash  
   npm install -g wrangler
   ```

2. **Log in to Cloudflare via Wrangler:**  
   ```Bash  
   wrangler login
   ```

   Follow the prompts to authenticate.  
3. Create a new Worker project:  
   If you haven't already, create your project directory and initialize the Worker.  
   ```Bash  
   wrangler init my-link-shortener  
   cd my-link-shortener
   ```

   Choose the "Worker" template. Wrangler will generate src/index.js (or .ts) and wrangler.jsonc (or .toml).  
4. Install nanoid:  
   (Note: nanoid is primarily used by the short-url-manager TUI for generating short codes.)  
   ```Bash  
   npm install nanoid
   ```

### **Cloudflare KV Namespace Setup**

Create two KV namespaces: one for production and one for development/preview.

```Bash

wrangler kv:namespace create SHORTENER_KV_PRODUCTION  
wrangler kv:namespace create SHORTENER_KV_PREVIEW --preview
```
**Important:** Note the id values provided in the output for both namespaces. You will need them for wrangler.jsonc.

### **Configuration (wrangler.jsonc)**

Open your wrangler.jsonc file (or wrangler.toml if you chose TOML) and update it.  
Key changes to make:

* Remove the assets block: This ensures your Worker handles all requests and doesn't fall back to serving static files for the root path.  
* Add KV Namespace Bindings: Use the id and preview_id from the previous step.  
* Add Cloudflare Workers Analytics Engine Binding (Optional): If you want to use Cloudflare's built-in analytics.

**Example wrangler.jsonc:**

```JSON

{  
  "$schema": "node_modules/wrangler/config-schema.json",  
  "name": "racket-link-shortener",  
  "main": "src/index.js",  
  "compatibility_date": "2025-07-05",
		"account_id": "YOUR_CLOUDFLARE_ACCOUNT_ID",
  "compatibility_flags": [  
    "nodejs_compat",  
    "global_fetch_strictly_public"  
  ],  
  "observability": {  
    "enabled": true  
  },  
  "kv_namespaces": [  
    {  
      "binding": "racket_shortener",  
      "id": "YOUR_PRODUCTION_KV_NAMESPACE_ID",  
      "preview_id": "YOUR_PREVIEW_KV_NAMESPACE_ID"  
    }  
  ],  
  "analytics_engine_datasets": [  
    {  
      "binding": "ANALYTICS",  
      "dataset": "link_shortener_events"  
    }  
  ]  
}
```
Replace YOUR_PRODUCTION_KV_NAMESPACE_ID and YOUR_PREVIEW_KV_NAMESPACE_ID with the actual IDs from your wrangler kv:namespace create output.

### **Google Analytics 4 (GA4) Setup (Optional)**

If you want to send data to GA4:

1. **Get GA4 Measurement ID and API Secret:**  
   * In your GA4 property, go to Admin > Data Streams > Web > Select your data stream.  
   * Copy your **Measurement ID** (e.g., G-XXXXXXXXXX).  
   * Under "Events", find "Measurement Protocol API secrets" and create a new secret, then copy the **API Secret**.

2. **Store GA4 Credentials as Secrets:**
     ```Bash
     wrangler secret put GOOGLE_ANALYTICS_MEASUREMENT_ID
     ```
   Paste your Measurement ID when prompted

   ```Bash
   wrangler secret put GOOGLE_ANALYTICS_API_SECRET
   ```
   
   Paste your API Secret when prompted** 

### **Deployment**

1. **Deploy your Worker:**  
   ```Bash  
   wrangler deploy
   ```

   This will deploy your Worker to Cloudflare, making it accessible via a workers.dev subdomain.  
2. Set up a Custom Domain (Optional but Recommended):  
   To use your own short domain (e.g., s.yourdomain.com):  
   * Log in to your Cloudflare dashboard.  
   * Go to Workers & Pages > Select your Worker.  
   * Navigate to **Settings > Triggers > Custom Domains**.  
   * Click "Add Custom Domain" and enter your desired subdomain (e.g., url.racket.gr). Cloudflare will handle DNS and SSL.

### **Usage**

#### **Creating Short Links**

Short URLs for this service are managed using the short-url-manager Terminal User Interface (TUI) application or directly via the wrangler Command Line Interface (CLI).  

***Using wrangler CLI (Manual Key-Value Pair Creation):***  
You can manually add short URL mappings directly to your Cloudflare KV namespace using wrangler.

```Bash

wrangler kv:key put --namespace-id YOUR_PRODUCTION_KV_NAMESPACE_ID "your-short-code" "[https://your-long-url.com](https://your-long-url.com)"
```

Replace YOUR_PRODUCTION_KV_NAMESPACE_ID with your actual production KV namespace ID, "your-short-code" with your desired short URL path, and "[https://your-long-url.com](https://your-long-url.com)" with the destination URL.

***Using short-url-manager TUI:***  
Refer to the [short-url-manager/README.md](short-url-manager/README.md) file within your repository for detailed instructions on how to set up and use the TUI to create, list, and manage your short URLs.  

#### **Accessing Short Links**

Visit your short URL in a browser (e.g., [https://url.racket.gr/mycustomlink](https://url.racket.gr/mycustomlink)). The Worker will **redirect** the user to the longUrl.

### **Analytics**

#### **Cloudflare Workers Analytics Engine**

* **View Metrics:** Log in to your Cloudflare dashboard, go to Workers & Pages > Select your Worker > Observability tab. You'll find charts and data based on the writeDataPoint calls.  
* **Query Data:** Use the Cloudflare GraphQL Analytics API to run custom queries against your link_shortener_events dataset for detailed insights.

#### **Google Analytics 4 (GA4) Measurement Protocol**

* **Debug View:** To verify events in real-time, ensure debug_mode: true is set in your Worker's GA4 payload (as shown in the src/index.js example). Then, go to GA4 Admin > DebugView. Look for your short_link_access events and check the "User Properties" panel on the right for Country, Region, and City data.  
* **Standard Reports:** After 24-48 hours, your GA4 standard reports (e.g., Demographics > Geographic details) will show the aggregated location data. Remember to set up custom definitions for link_short_code and link_longUrl if you want them as dimensions in GA4 reports.

## **Contributing**

If you'd like to contribute to this project, please refer to the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.

## **License**

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.
