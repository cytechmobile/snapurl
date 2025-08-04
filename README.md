# **SnapURL**

A high-performance URL shortener implemented using Cloudflare Workers and Cloudflare KV. This project allows you to create custom short links that **redirect** users to the original long **URL**, all while providing options for detailed analytics.

## **Features**

- **Custom Short Links:** Create unique, memorable short URLs (e.g., yourshort.link/my-project).
- **URL Redirection:** The Worker sends an HTTP redirect (302 Found) to the user's browser, directing them to the original long URL.
- **Cloudflare KV Storage:** Leverages Cloudflare's Key-Value store for fast and globally distributed storage of URL mappings.
- **Analytics Integration:**
  - **Cloudflare Workers Analytics Engine:** Built-in integration for logging event data (short code accessed, country, user agent) for scalable, real-time analytics within the Cloudflare dashboard.
  - **Google Analytics 4 (GA4) Measurement Protocol:** Option to send detailed event data (including geographical information like country, region, and city) directly to your GA4 property for comprehensive tracking.

## Management Interfaces

You can manage your short links using the provided Web UI:

**Web UI (Recommended):** A user-friendly, local web interface for creating, deleting, and viewing links, complete with QR code generation. The Web UI now features a server-based architecture to securely handle Cloudflare API requests and requires Google authentication for access. Access is restricted to a predefined list of authorized Google email addresses. See the [Web UI README](./web-ui/README.md) for setup instructions.

The Web UI has been improved to provide more consistent and user-friendly feedback, including clearer error messages, client-side validation, and notifications for all operations.

## Core Setup (Cloudflare Worker)

This section covers the one-time setup for the Cloudflare Worker that powers the redirection service.

### Prerequisites

1.  **Cloudflare Account:** An active Cloudflare account.
2.  **Domain:** A domain registered and managed by Cloudflare DNS. You'll typically use a subdomain (e.g., `s.yourdomain.com`) for your short links.
3.  **Node.js & npm:** Ensure you have Node.js installed on your local machine.

### Installation & Configuration

1.  **Create KV Namespace:**
    *   Log in to your Cloudflare dashboard.
    *   Go to **Workers & Pages** > **KV**.
    *   Click "Create a namespace" and give it a name (e.g., `SNAPURL_KV`). Note down its ID.

2.  **Configure Worker Settings:**
    *   Go to **Workers & Pages** > Select your Worker.
    *   Navigate to **Settings > Variables**.
    *   **KV Namespace Binding:** Under "KV Namespace Bindings", add a new binding:
        *   Variable name: `SNAPURL_KV`
        *   KV namespace: Select the namespace you created in step 1.
    *   **Root Redirect URL:** Under "Environment Variables", add a new variable:
        *   Variable name: `ROOT_REDIRECT_URL`
        *   Value: `https://your-main-website.com` (or your desired root redirect URL)
    *   **(Optional) Configure Analytics Secrets:** Under "Secrets", add the following secrets if you plan to use Google Analytics:
        *   Secret name: `GOOGLE_ANALYTICS_MEASUREMENT_ID`
        *   Secret name: `GOOGLE_ANALYTICS_API_SECRET`

### Deployment

1.  **Deploy the Worker:**
    *   Go to **Workers & Pages** > Select your Worker.
    *   Navigate to **Overview**.
    *   Click "Quick Edit" or "Deploy" to paste your Worker code (from `src/index.js`) directly into the editor, or upload it.

2.  **Set up a Custom Domain:**
    For a professional look, use your own short domain (e.g., `s.yourdomain.com`):
    - Log in to your Cloudflare dashboard.
    - Go to **Workers & Pages** > Select your Worker.
    - Navigate to **Settings > Triggers > Custom Domains**.
    - Click "Add Custom Domain" and follow the instructions.

## Usage

Once the worker is deployed, use one of the [Management Interfaces](#management-interfaces) to create and manage your short links.

### Accessing Short Links

Visit your short URL in a browser (e.g., `https://s.yourdomain.com/my-link`). The Worker will redirect the user to the long URL.

### **Analytics**

#### **Cloudflare Workers Analytics Engine**

- **View Metrics:** Log in to your Cloudflare dashboard, go to Workers & Pages > Select your Worker > Observability tab. You'll find charts and data based on the writeDataPoint calls.
- **Query Data:** Use the Cloudflare GraphQL Analytics API to run custom queries against your link_shortener_events dataset for detailed insights.

#### **Google Analytics 4 (GA4) Measurement Protocol**

- **Debug View:** To verify events in real-time, ensure debug_mode: true is set in your Worker's GA4 payload (as shown in the src/index.js example). Then, go to GA4 Admin > DebugView. Look for your short_link_access events and check the "User Properties" panel on the right for Country, Region, and City data.
- **Standard Reports:** After 24-48 hours, your GA4 standard reports (e.g., Demographics > Geographic details) will show the aggregated location data. Remember to set up custom definitions for link_short_code and link_longUrl if you want them as dimensions in GA4 reports.

## **Contributing**

If you'd like to contribute to this project, please refer to the [LICENSE](LICENSE) file for details.

## **License**

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for details.
