# Web UI for URL Shortener Manager

This directory contains a local-only web application that provides a graphical user interface (UI) for managing the Cloudflare URL Shortener. It is designed to be run on your local machine and acts as a more user-friendly alternative to the command-line TUI.

## How It Works

This is not a traditional, public-facing web application. It consists of two main parts:

1.  **Local API Server (`server.js`):** A lightweight [Express.js](https://expressjs.com/) server that runs on your machine. It listens for requests from the frontend and securely executes `wrangler` commands to interact with your Cloudflare KV namespace. This ensures no management functions are ever exposed to the internet.
2.  **React Frontend (`client/`):** A modern [React](https://react.dev/) application built with [Vite](https://vitejs.dev/) that provides the user interface. It runs in your browser and communicates with the local API server.

## Technology Stack

-   **Backend:** Node.js, Express.js
-   **Frontend:** React, Vite, Bootstrap
-   **Interaction with Cloudflare:** The server uses the `wrangler` CLI tool.

---

## Development Mode

In development mode, you run two separate processes: the API server and the Vite development server for the client. The Vite server provides features like Hot Module Replacement (HMR) for a better development experience.

**1. Start the API Server:**
In a terminal, navigate to the `web-ui` directory and run:
```bash
node server.js
```
The API server will start on `http://localhost:3001`.

**2. Start the React Client:**
In a *second* terminal, navigate to the `web-ui/client` directory and run:
```bash
npm run dev
```
The client development server will typically start on `http://localhost:5173`. You can access the UI by opening this URL in your browser.

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
