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
