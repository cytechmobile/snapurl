

# **SnapURL**

A high-performance URL shortener implemented using Cloudflare Workers and Cloudflare KV. This project allows you to create custom short links that **redirect** users to the original long **URL**, all while providing options for detailed analytics.

## **Features**

* **Custom Short Links:** Create unique, memorable short URLs (e.g., yourshort.link/my-project).  
* **URL Redirection:** The Worker sends an HTTP redirect (302 Found) to the user's browser, directing them to the original long URL.  
* **Cloudflare KV Storage:** Leverages Cloudflare's Key-Value store for fast and globally distributed storage of URL mappings.  
* **Analytics Integration:**  
  * **Cloudflare Workers Analytics Engine:** Built-in integration for logging event data (short code accessed, country, user agent) for scalable, real-time analytics within the Cloudflare dashboard.  
  * **Google Analytics 4 (GA4) Measurement Protocol:** Option to send detailed event data (including geographical information like country, region, and city) directly to your GA4 property for comprehensive tracking.  

## Management Interfaces

You can manage your short links using two provided tools:

1.  **Web UI (Recommended):** A user-friendly, local web interface for creating, deleting, and viewing links, complete with QR code generation. See the [Web UI README](./web-ui/README.md) for setup instructions.
2.  **TUI (Terminal UI):** A command-line interface for managing links directly from your terminal. See the [TUI README](./short-url-manager/README.md) for details.

## Core Setup (Cloudflare Worker)

This section covers the one-time setup for the Cloudflare Worker that powers the redirection service.

### Prerequisites

1.  **Cloudflare Account:** An active Cloudflare account.
2.  **Domain:** A domain registered and managed by Cloudflare DNS. You'll typically use a subdomain (e.g., `s.yourdomain.com`) for your short links.
3.  **Node.js & npm:** Ensure you have Node.js installed on your local machine.

### Installation & Configuration

1.  **Install Wrangler CLI:**
    ```bash
    npm install -g wrangler
    ```

2.  **Log in to Cloudflare:**
    ```bash
    wrangler login
    ```

3.  **Configure `wrangler.jsonc`:**
    Open `wrangler.jsonc` and fill in your `account_id`. Then, create a KV namespace for your links by running:
    ```bash
    # This creates the production namespace
    wrangler kv:namespace create "SNAPURL_KV"

    # This creates a preview namespace for testing
    wrangler kv:namespace create "SNAPURL_KV" --preview
    ```
    Wrangler will output the `id` and `preview_id` for your new namespaces. **Copy these IDs** and paste them into the `kv_namespaces` section of your `wrangler.jsonc` file.

4.  **Add Root Redirect URL:**
    In `wrangler.jsonc`, add a `vars` section to specify where requests to the root of your shortener domain should redirect:
    ```json
    "vars": {
      "ROOT_REDIRECT_URL": "https://your-main-website.com"
    }
    ```

5.  **(Optional) Configure Analytics Secrets:**
    If you plan to use Google Analytics, store your credentials as encrypted secrets:
    ```bash
    wrangler secret put GOOGLE_ANALYTICS_MEASUREMENT_ID
    wrangler secret put GOOGLE_ANALYTICS_API_SECRET
    ```

### Deployment

1.  **Deploy the Worker:**
    ```bash
    wrangler deploy
    ```

2.  **Set up a Custom Domain:**
    For a professional look, use your own short domain (e.g., `s.yourdomain.com`):
    *   Log in to your Cloudflare dashboard.
    *   Go to **Workers & Pages** > Select your Worker.
    *   Navigate to **Settings > Triggers > Custom Domains**.
    *   Click "Add Custom Domain" and follow the instructions.

## Usage

Once the worker is deployed, use one of the [Management Interfaces](#management-interfaces) to create and manage your short links.

### Accessing Short Links

Visit your short URL in a browser (e.g., `https://s.yourdomain.com/my-link`). The Worker will redirect the user to the long URL.


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
