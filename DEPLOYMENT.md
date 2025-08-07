# SnapURL Deployment Guide

This guide provides a comprehensive, step-by-step walkthrough for deploying the entire SnapURL project, including the core URL shortener, the API worker, the web UI, and the required Cloudflare Access configuration.

## Architecture Overview

The project consists of three main components:

1.  **Core Redirector Worker:** A simple, high-performance worker that handles incoming short links and redirects users to the long URL.
2.  **API Worker (`snapurl-web-ui-server`):** A backend worker that provides a REST API for managing URL mappings in Cloudflare KV.
3.  **UI Worker (`snapurl-web-ui`):** A worker that serves the static assets for the React-based management interface.

All management interfaces (the UI and API workers) are secured by a single Cloudflare Access application.

## Prerequisites

Before you begin, ensure you have the following:

- An active Cloudflare account.
- A domain registered and managed by Cloudflare DNS.
- At least two subdomains for that domain (e.g., `s.yourdomain.com` for the redirector and `manage.yourdomain.com` for the UI).
- Node.js and npm installed on your local machine.
- The `wrangler` CLI installed (`npm install -g wrangler`).

---

## Step 1: Infrastructure Setup

### Create the KV Namespace

First, we need to create a Key-Value (KV) namespace to store the URL mappings.

1.  Log in to your Cloudflare dashboard.
2.  In the sidebar, navigate to **Workers & Pages > KV**.
3.  Click **Create a namespace** and give it a name, for example, `SNAPURL_KV`.
4.  After creation, **copy the ID** of the new namespace. You will need it in the following steps.

---

## Step 2: Deploy the Workers

### 1. Deploy the Core Redirector Worker

This worker handles the actual URL redirection.

1.  In the Cloudflare dashboard, go to **Workers & Pages** and click **Create Application**.
2.  Select **Create Worker**.
3.  Give it a name (e.g., `snapurl-redirector`) and click **Deploy**.
4.  Click **Quick Edit**.
5.  Copy the entire content of the `src/index.js` file from this project and paste it into the editor, replacing the default code.
6.  Navigate to the worker's **Settings > Variables** tab.
7.  **Add KV Namespace Binding:**
    *   Variable name: `SNAPURL_KV`
    *   KV namespace: Select the `SNAPURL_KV` namespace you created earlier.
8.  **Add Environment Variable:**
    *   Variable name: `ROOT_REDIRECT_URL`
    *   Value: The URL you want users to be redirected to if they visit the root of your shortener domain (e.g., `https://your-main-website.com`).
9.  Click **Save and Deploy**.

### 2. Deploy the API Worker

This worker provides the backend API for the management UI.

1.  Navigate to the `web-ui/web-ui-server-worker` directory in your local project.
2.  Open the `wrangler.toml` file.
3.  Find the `[[kv_namespaces]]` section and replace the placeholder `id` with the **KV Namespace ID** you copied in Step 1.
4.  In your terminal, from the `web-ui/web-ui-server-worker` directory, run the deployment command:
    ```bash
    npx wrangler deploy
    ```

### 3. Deploy the UI Worker

This worker serves the React management interface.

1.  Navigate to the `web-ui/client` directory.
2.  Create a new file named `.env`.
3.  Add the following content to the `.env` file, replacing the placeholder values:
    ```
    # The domain of your Cloudflare Access login page (e.g., my-team.cloudflareaccess.com)
    VITE_AUTH_DOMAIN=your_auth_domain_from_step_4

    # The full base URL for your deployed API worker (e.g., https://api.yourdomain.com/api)
    VITE_API_BASE_URL=https://your_api_worker_domain/api
    ```
4.  In your terminal, navigate to the `web-ui` directory and run the deployment command:
    ```bash
    npx wrangler deploy
    ```

---

## Step 3: Configure Custom Domains

Now, assign your custom subdomains to the deployed workers.

1.  In the Cloudflare dashboard, navigate to your main domain's settings.
2.  Go to **Workers & Pages**.
3.  For each of the three workers (`snapurl-redirector`, `snapurl-web-ui-server`, `snapurl-web-ui`), do the following:
    *   Click on the worker.
    *   Go to the **Triggers** tab.
    *   Under **Custom Domains**, click **Add Custom Domain** and assign the appropriate subdomain (e.g., `s.yourdomain.com` for the redirector, `api.yourdomain.com` for the API, and `manage.yourdomain.com` for the UI).

---

## Step 4: Configure Cloudflare Access

This is the final and most critical step to secure your management interface.

1.  In the [Zero Trust Dashboard](https://one.dash.cloudflare.com/), go to **Access -> Applications**.
2.  Click **Add an application** and select **Self-hosted**.
3.  **Configure the application:**
    *   **Application name:** `SnapURL Management` (or your preferred name).
    *   **Application domain:** Add the custom domains for both your UI and API workers (e.g., `manage.yourdomain.com` and `api.yourdomain.com`).
4.  **Create a login policy:**
    *   On the next page, create an `Allow` policy to grant access to yourself and other authorized users (e.g., by email address).
5.  **Configure CORS and Cookie Settings:**
    *   After creating the application, click **Edit** and go to the **Settings** tab.
    *   Scroll down to **Advanced settings**.
    *   **Enable** the **Bypass OPTIONS requests to origin** toggle.
    *   Under **Cross-Origin Resource Sharing (CORS) settings**:
        *   **Allow origins:** Add the full URL of your UI worker (e.g., `https://manage.yourdomain.com`).
        *   **Allow methods:** Select `GET`, `POST`, `PUT`, and `DELETE`.
        *   **Allow headers:** Add `Content-Type`, `Authorization`, and `Cf-Access-Jwt-Assertion`.
6.  **Save** the application.

---

## Step 5: Final Verification

1.  Navigate to the custom domain you set for the UI (e.g., `https://manage.yourdomain.com`).
2.  You should be redirected to the Cloudflare Access login page.
3.  Log in with the identity you authorized in your Access policy.
4.  Once logged in, the SnapURL management interface should load and be fully functional.

Your SnapURL project is now fully deployed and secured!
