# **Cloudflare URL Shortener**

A high-performance, privacy-conscious URL shortener implemented using Cloudflare Workers and Cloudflare KV. This project allows you to create custom short links that **redirect** users to the original long **URL**, all while providing options for detailed analytics.

## **Features**

* **Custom Short Links:** Create unique, memorable short URLs (e.g., yourshort.link/my-project).  
* **URL Redirection:** The Worker sends an HTTP redirect (302 Found) to the user's browser, directing them to the original long URL.  
* **Cloudflare KV Storage:** Leverages Cloudflare's Key-Value store for fast and globally distributed storage of URL mappings.  
* **Analytics Integration:**  
  * **Cloudflare Workers Analytics Engine:** Built-in integration for logging event data (short code accessed, country, user agent) for scalable, real-time analytics within the Cloudflare dashboard.  
  * **Google Analytics 4 (GA4) Measurement Protocol:** Option to send detailed event data (including geographical information like country, region, and city) directly to your GA4 property for comprehensive tracking.  
* **Privacy-Focused:** Utilizes random UUIDs for client\_id when sending to GA4 to avoid directly tracking user IPs.

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
   npm install \-g wrangler

2. **Log in to Cloudflare via Wrangler:**  
   wrangler login

   Follow the prompts to authenticate.  
3. Create a new Worker project:  
   If you haven't already, create your project directory and initialize the Worker.  
   wrangler init my-link-shortener  
   cd my-link-shortener

   Choose the "Worker" template. Wrangler will generate src/index.js (or .ts) and wrangler.jsonc (or .toml).  
4. Install nanoid:  
   (Note: nanoid is primarily used by the racket-url-manager TUI for generating short codes.)  
   npm install nanoid

### **Cloudflare KV Namespace Setup**

Create two KV namespaces: one for production and one for development/preview.  
wrangler kv:namespace create SHORTENER\_KV\_PRODUCTION  
wrangler kv:namespace create SHORTENER\_KV\_PREVIEW \--preview

**Important:** Note the id values provided in the output for both namespaces. You will need them for wrangler.jsonc.

### **Configuration (wrangler.jsonc)**

Open your wrangler.jsonc file (or wrangler.toml if you chose TOML) and update it.  
**Key changes to make:**

* Remove the assets block: This ensures your Worker handles all requests and doesn't fall back to serving static files for the root path.  
* Add KV Namespace Bindings: Use the id and preview\_id from the previous step.  
* Add Cloudflare Workers Analytics Engine Binding (Optional): If you want to use Cloudflare's built-in analytics.

**Example wrangler.jsonc:**  
{  
  "$schema": "node\_modules/wrangler/config-schema.json",  
  "name": "racket-link-shortener",  
  "main": "src/index.js",  
  "compatibility\_date": "2025-07-05",  
  "compatibility\_flags": \[  
    "nodejs\_compat",  
    "global\_fetch\_strictly\_public"  
  \],  
  // REMOVE THE "assets" BLOCK ENTIRELY if it exists  
  // "assets": {  
  //   "directory": "./public"  
  // },  
  "observability": {  
    "enabled": true  
  },  
  "kv\_namespaces": \[  
    {  
      "binding": "racket\_shortener", // This is the name your Worker code will use (e.g., env.racket\_shortener)  
      "id": "YOUR\_PRODUCTION\_KV\_NAMESPACE\_ID",  
      "preview\_id": "YOUR\_PREVIEW\_KV\_NAMESPACE\_ID"  
    }  
  \],  
  "analytics\_engine\_datasets": \[ // Add this section for Cloudflare Analytics Engine  
    {  
      "binding": "ANALYTICS", // This is the binding name you'll use in your Worker code  
      "dataset": "link\_shortener\_events" // This is the name of your dataset  
    }  
  \]  
}

Replace YOUR\_PRODUCTION\_KV\_NAMESPACE\_ID and YOUR\_PREVIEW\_KV\_NAMESPACE\_ID with the actual IDs from your wrangler kv:namespace create output.

### **Google Analytics 4 (GA4) Setup (Optional)**

If you want to send data to GA4:

1. **Get GA4 Measurement ID and API Secret:**  
   * In your GA4 property, go to Admin \> Data Streams \> Web \> Select your data stream.  
   * Copy your **Measurement ID** (e.g., G-XXXXXXXXXX).  
   * Under "Events", find "Measurement Protocol API secrets" and create a new secret, then copy the **API Secret**.  
2. **Store GA4 Credentials as Secrets:**  
   wrangler secret put GOOGLE\_ANALYTICS\_MEASUREMENT\_ID  
   \# Paste your Measurement ID when prompted

   wrangler secret put GOOGLE\_ANALYTICS\_API\_SECRET  
   \# Paste your API Secret when prompted

### **Deployment**

1. **Deploy your Worker:**  
   wrangler deploy

   This will deploy your Worker to Cloudflare, making it accessible via a workers.dev subdomain.  
2. Set up a Custom Domain (Optional but Recommended):  
   To use your own short domain (e.g., s.yourdomain.com):  
   * Log in to your Cloudflare dashboard.  
   * Go to Workers & Pages \> Select your Worker.  
   * Navigate to **Settings \> Triggers \> Custom Domains**.  
   * Click "Add Custom Domain" and enter your desired subdomain (e.g., url.racket.gr). Cloudflare will handle DNS and SSL.

### **Usage**

#### **Creating Short Links**

Short URLs for this service are managed using the **racket-url-manager Terminal User Interface (TUI)** application or directly via the **wrangler Command Line Interface (CLI)**.  
Using racket-url-manager TUI:  
Refer to the racket-url-manager/README.md file within your repository for detailed instructions on how to set up and use the TUI to create, list, and manage your short URLs.  
Using wrangler CLI (Manual Key-Value Pair Creation):  
You can manually add short URL mappings directly to your Cloudflare KV namespace using wrangler.  
wrangler kv:key put \--namespace-id YOUR\_PRODUCTION\_KV\_NAMESPACE\_ID "your-short-code" "\[https://your-long-url.com\](https://your-long-url.com)"

Replace YOUR\_PRODUCTION\_KV\_NAMESPACE\_ID with your actual production KV namespace ID, "your-short-code" with your desired short URL path, and "https://your-long-url.com" with the destination URL.

#### **Accessing Short Links**

Visit your short URL in a browser (e.g., https://url.racket.gr/mycustomlink). The Worker will **redirect** the user to the longUrl.

### **Analytics**

#### **Cloudflare Workers Analytics Engine**

* **View Metrics:** Log in to your Cloudflare dashboard, go to Workers & Pages \> Select your Worker \> Observability tab. You'll find charts and data based on the writeDataPoint calls.  
* **Query Data:** Use the Cloudflare GraphQL Analytics API to run custom queries against your link\_shortener\_events dataset for detailed insights.

#### **Google Analytics 4 (GA4) Measurement Protocol**

* **Debug View:** To verify events in real-time, ensure debug\_mode: true is set in your Worker's GA4 payload (as shown in the src/index.js example). Then, go to GA4 Admin \> DebugView. Look for your short\_link\_access events and check the "User Properties" panel on the right for Country, Region, and City data.  
* **Standard Reports:** After 24-48 hours, your GA4 standard reports (e.g., Demographics \> Geographic details) will show the aggregated location data. Remember to set up custom definitions for link\_short\_code and link\_longUrl if you want them as dimensions in GA4 reports.

## **Contributing**

If you'd like to contribute to this project, please refer to the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.

## **License**

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.