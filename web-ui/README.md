# Web UI for SnapURL

This directory contains the assets for the SnapURL web interface. It is a modern, single-page application (SPA) built with React and Vite, and served via Cloudflare Workers.

## Architecture

The web UI is composed of a React frontend and a backend API, which are deployed as two separate Cloudflare Workers:

1.  **Client (React SPA):** The single-page application, located in the `client/` directory. It is a standard Vite-based React application.

2.  **UI Worker (`workers-site`):** This is a simple worker that serves the built static assets (HTML, CSS, JavaScript) of the React application. It uses the configuration in `web-ui/wrangler.toml` to act as a static site host.

3.  **API Worker (`web-ui-server-worker`):** This worker, located in the `web-ui-server-worker/` directory, provides a backend API for the UI. It handles all the logic for creating, reading, updating, and deleting URL mappings in the Cloudflare KV namespace.

Both the UI and API workers should be protected by a single **Cloudflare Access** application, which ensures that only authenticated and authorized users can access the UI and its corresponding API.

## Features

- **Cloudflare Access Integration:** Securely log in using any identity provider configured in your Cloudflare Zero Trust account (e.g., Google, GitHub, one-time password).
- **Full CRUD Operations:** Create, read, update, and delete short links.
- **QR Code Generation:** Instantly generate a QR code for any short link.
- **Configurable Hostname:** Set your short link domain directly in the UI (persisted in browser storage).
- **UTM Parameter Support:** Add `utm_source`, `utm_medium`, and `utm_campaign` parameters when creating links.
- **Search and Refresh:** Easily find links across all pages and refresh the data from Cloudflare KV.
- **URL Validation:** Real-time validation of long URLs for reachability and format.
- **Enhanced User Feedback:** Clear error messages and notifications for all operations.
- **Pagination:** Navigate through large sets of short URLs with customizable items per page.

## Configuration

All configuration for the web UI is managed through Cloudflare's dashboard and the respective `wrangler.toml` files.

1.  **Cloudflare Access:**
    *   A single Cloudflare Access application should be configured to protect the domains of both the UI worker and the API worker.
    *   The Access application's CORS (Cross-Origin Resource Sharing) settings must be configured to allow requests from the UI's domain to the API's domain.

2.  **Client Configuration (`web-ui/client/.env`):**
    This file contains the build-time configuration for the React application:

    ```
    # The full base URL for your deployed API worker
    VITE_API_BASE_URL=https://your-api-worker.workers.dev
    ```

## Development

For local development, you can run the Vite development server for the client. You will need to have a deployed version of the API worker to point to.

```bash
# From the web-ui/client/ directory
npm install
npm run dev
```

## Deployment

To deploy the application, you must deploy both workers separately from their respective directories.

```bash
# Deploy the UI Worker
cd web-ui
npx wrangler deploy

# Deploy the API Worker
cd web-ui-server-worker
npx wrangler deploy
```
