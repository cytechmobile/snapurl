# Web UI for SnapURL

This directory contains a local-only web application that provides a graphical user interface (UI) for managing SnapURL. It is designed to be run on your local machine and acts as a more user-friendly alternative to the command-line TUI.

## Features

-   **Full CRUD Operations:** Create, read, update, and delete short links.
-   **QR Code Generation:** Instantly generate a QR code for any short link.
-   **Configurable Hostname:** Set your short link domain directly in the UI (persisted in browser storage).
-   **UTM Parameter Support:** Add `utm_source`, `utm_medium`, and `utm_campaign` parameters when creating links.
-   **Search and Refresh:** Easily find links across all pages and refresh the local cache from Cloudflare KV.
-   **Pagination:** Navigate through large sets of short URLs with customizable items per page.

## How It Works

This is not a traditional, public-facing web application. It consists of two main parts:

1.  **Local API Server (`server.js`):** A lightweight Express.js server that runs on your machine. It listens for requests from the frontend and securely executes `wrangler` commands to interact with your Cloudflare KV namespace.
2.  **React Frontend (`client/`):** A modern React application built with Vite that provides the user interface. It runs in your browser and communicates with the local API server.

## Configuration

Before running the application, you need to create two `.env` files.

1.  **Server Configuration (`web-ui/.env`):**
    Create a file named `.env` in the `web-ui/` directory with the following content:
    ```
    # The port for the local web UI server to run on.
    PORT=3001
    ```

2.  **Client Configuration (`web-ui/client/.env`):**
    Create a file named `.env` in the `web-ui/client/` directory with the following content:
    ```
    # The default URL for your Cloudflare Worker.
    VITE_WORKER_URL=https://your-shortener.workers.dev

    # The base URL for the local API server
    VITE_API_BASE_URL=http://localhost:3001/api
    ```
    **Note:** The `VITE_` prefix is required by Vite.

## Development Mode

In development mode, you run two separate processes: the API server and the Vite development server for the client.

**1. Start the API Server:**
In a terminal, navigate to the `web-ui` directory and run:
```bash
npm install
node server.js
```
The API server will start on the port you defined in `.env` (e.g., `http://localhost:3001`).

**2. Start the React Client:**
In a *second* terminal, navigate to the `web-ui/client` directory and run:
```bash
npm install
npm run dev
```
The client development server will typically start on `http://localhost:5173`. Open this URL in your browser to use the application.

---

## Production Mode

In production mode, the React application is first built into a set of optimized, static files. The local API server then serves these files directly, so you only need to run one process.

**1. Build the Client:**
First, create the production build of the UI.
```bash
# From the web-ui/client/ directory
npm run build
```
This will create a `dist` directory inside `web-ui/client`. You only need to do this when you have made changes to the client-side code.

**2. Run the Production Server:**
Navigate to the `web-ui` directory and start the server.
```bash
# From the web-ui/ directory
node server.js
```
The server will now handle everything. You can access the application by opening your browser to **http://localhost:3001**.
<img width="1049" height="927" alt="Screenshot 2025-07-31 at 09 18 13" src="https://github.com/user-attachments/assets/fc8cfb81-3158-47e6-9f3b-c95bbad2037f" />


## Requirements

-   Node.js 18.0.0 or higher
-   **Wrangler CLI** installed and authenticated
-   **Cloudflare account access** to the `snapurl` project

## Security Considerations

-   This Web UI is designed for **local, authenticated use only**. It directly executes `wrangler` commands on your machine.
-   **Do NOT expose this server to the public internet.** It does not have authentication mechanisms suitable for public access.
-   Ensure your `wrangler` CLI is properly authenticated to your Cloudflare account (run `wrangler login`).

## Troubleshooting

-   **"Cannot find module 'express'" or similar:** Run `npm install` in both `web-ui/` and `web-ui/client/` directories.
-   **"Wrangler command failed":** Ensure `wrangler` is installed globally (`npm install -g wrangler`) and you are authenticated (`wrangler login`). Check your Cloudflare permissions for the KV namespace.
-   **"CSV file not found" warning:** This is normal on first run - the CSV file will be created automatically
-   **Frontend not loading:** Verify both the API server and the React client are running (in development mode). In production mode, ensure the client has been built (`npm run build`) and the server is running.
-   **CORS errors:** Ensure `VITE_API_BASE_URL` in `web-ui/client/.env` matches the `PORT` in `web-ui/.env` and the server's actual running port.

## License

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.

---

Built for SnapURL 🔗