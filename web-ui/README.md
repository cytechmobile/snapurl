# Web UI for SnapURL

This directory contains the assets for the SnapURL web interface. It is a modern, single-page application (SPA) built with React and Vite, and it is deployed as a Cloudflare Worker.

## Architecture

The web UI is composed of two distinct Cloudflare Workers that work together:

1.  **UI Worker (`web-ui`):** This worker, defined in `web-ui/wrangler.toml`, is responsible for serving the static assets (HTML, CSS, JavaScript) of the React application. It is the primary entry point for users.

2.  **API Worker (`web-ui-server-worker`):** This worker provides a backend API for the UI to communicate with. It handles all the logic for creating, reading, updating, and deleting URL mappings in the Cloudflare KV namespace.

Both workers are protected by a single **Cloudflare Access** application, which ensures that only authenticated and authorized users can access the UI and its corresponding API.

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

All configuration for the web UI is now managed through Cloudflare's dashboard and the respective `wrangler.toml` files.

1.  **Cloudflare Access:**
    *   A single Cloudflare Access application should be configured to protect the domains of both the UI worker and the API worker.
    *   The Access application's CORS (Cross-Origin Resource Sharing) settings must be configured to allow requests from the UI's domain to the API's domain.

2.  **Client Configuration (`web-ui/client/.env`):**
    This file contains the build-time configuration for the React application:

    ```
    # The domain of your Cloudflare Access login page (e.g., my-team.cloudflareaccess.com)
    VITE_AUTH_DOMAIN=your_auth_domain

    # The full base URL for your deployed API worker
    VITE_API_BASE_URL=https://your-api-worker.workers.dev/api
    ```

## Development

For local development, you can run the Vite development server for the client. You will need to have a deployed version of the API worker to point to.

```bash
# From the web-ui/client/ directory
npm install
npm run dev
```

## Deployment

To deploy the web UI, you deploy the `web-ui` worker. This will automatically build the client application and include it in the deployment.

```bash
# From the web-ui/ directory
npx wrangler deploy
```