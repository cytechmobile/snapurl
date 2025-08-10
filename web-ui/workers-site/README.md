# UI Serving Worker

This Cloudflare Worker is responsible for serving the static assets (HTML, CSS, JavaScript) of the SnapURL React user interface.

## How It Works

This worker uses the `@cloudflare/kv-asset-handler` library to retrieve and serve the built files of the React application.

Its configuration is managed in the `wrangler.toml` file located in the parent `web-ui` directory. That file specifies two important things:
1.  `main = "workers-site/index.js"`: Sets this script as the entry point.
2.  `[site] bucket = "./client/dist"`: Tells the worker to serve files from the React application's build output directory.

The script also includes a fallback mechanism to serve the main `index.html` file for any request that doesn't match a static asset. This is standard practice for Single-Page Applications (SPAs) to ensure that client-side routing works correctly.

---

*This file generally does not need to be modified unless the core asset-serving logic needs to change.*
