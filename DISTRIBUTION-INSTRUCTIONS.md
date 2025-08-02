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

### Step 1: Authenticate with Cloudflare

You must log in to your Cloudflare account so `wrangler` can manage your KV namespaces. You only need to do this once.

Choose **one** of the following methods:

**Method A: Browser Login (Recommended for most users)**
Run the following command and follow the instructions to log in via your web browser:
```bash
wrangler login
```

**Method B: API Token (More secure for automated environments)**
1.  Create a Cloudflare API Token with the "Edit Cloudflare Workers" template.
2.  Set the following environment variables in your terminal, replacing the values with your own credentials:
    ```bash
    export CLOUDFLARE_ACCOUNT_ID="your_account_id_here"
    export CLOUDFLARE_API_TOKEN="your_api_token_here"
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