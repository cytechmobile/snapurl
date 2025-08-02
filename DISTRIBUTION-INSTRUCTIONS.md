# Distribution and Installation Guide

This application is a **local management tool** with a web interface. It is not designed to be deployed on a public web server. It must be run on your local machine to securely interact with your Cloudflare account via the `wrangler` command-line tool.

## What to Distribute

To share this application, create a `.zip` archive of the entire project directory, but be sure to **exclude** all `node_modules` folders. The person you send it to will install these dependencies themselves.

The recipient should receive:
- `web-ui/` (including the `client/` sub-directory)
- `short-url-manager/`
- `src/`
- `package.json`
- `wrangler.jsonc`
- and all other project configuration files.

## Prerequisites

Before you begin, you must have the following installed on your computer:

1.  **Node.js and npm:** [Download from the official Node.js website](https://nodejs.org/).
2.  **Cloudflare Wrangler:** Install it globally by running this command in your terminal:
    ```bash
    npm install -g wrangler
    ```

## Installation and Setup

### Step 1: Configure Cloudflare API Credentials

To allow the Web UI server to interact with your Cloudflare KV namespace, you need to provide your Cloudflare API credentials. These should be set as environment variables in the `web-ui/.env` file.

1.  **Generate a Cloudflare API Token:**
    *   Go to your Cloudflare dashboard.
    *   Click on "My Profile" (top right corner) -> "API Tokens" -> "Create Token".
    *   Use the "Workers KV Storage Read" and "Workers KV Storage Write" templates, or create a custom token with equivalent permissions.

2.  **Find your Cloudflare Account ID:**
    *   You can find your Account ID on the right sidebar of your Cloudflare dashboard, under "Workers & Pages" or "Overview" for any domain.

3.  **Find your KV Namespace ID:**
    *   Go to "Workers & Pages" -> "KV" -> Select your KV namespace.
    *   The Namespace ID will be displayed on the page.

4.  **Update `web-ui/.env`:**
    Add the following lines to your `web-ui/.env` file, replacing the placeholder values with your actual credentials:
    ```
    CLOUDFLARE_API_TOKEN="your_cloudflare_api_token_here"
    CLOUDFLARE_ACCOUNT_ID="your_cloudflare_account_id_here"
    CLOUDFLARE_KV_NAMESPACE_ID="your_cloudflare_kv_namespace_id_here"
    ```

### Step 2: Configure the Application

Before installing dependencies, you must create the necessary configuration files.

1.  **Configure the Web UI Server:**
    -   Navigate to the `web-ui/` directory.
    -   Create a file named `.env`.
    -   Add the following content, adjusting the port if needed:
        ```
        PORT=3001
        ```

2.  **Configure the Web UI Client:**
    -   Navigate to the `web-ui/client/` directory.
    -   Create a file named `.env`.
    -   Add the following content, **replacing the `VITE_WORKER_URL` with the URL of your deployed Cloudflare Worker**:
        ```
        VITE_WORKER_URL=https://your-shortener.workers.dev
        VITE_API_BASE_URL=http://localhost:3001/api
        ```

### Step 3: Install Dependencies

Navigate to the project's root directory in your terminal and run the following commands to install the necessary packages for both the server and the client UI.

1.  **Install Server Dependencies:**
    ```bash
    # Navigate to the web-ui/ directory
    npm install
    ```

### Step 4: Build the User Interface

The web interface needs to be compiled into optimized, static files.

```bash
# From the web-ui/client/ directory
npm run build
```
This will create a `dist` folder inside `web-ui/client`.

## Running the Application

To run the application, you only need to start the local server. It will handle both the backend API and serving the user interface you just built.

1.  Navigate to the `web-ui` directory:
    ```bash
    # If you are in web-ui/client, go up one level
    cd .. 
    ```

2.  Start the server:
    ```bash
    node server.js
    ```

The server will now be running. You can access the URL Shortener Manager by opening your web browser and navigating to:

**http://localhost:3001**