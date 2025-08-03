# SnapURL Web UI Client

This is the client-side application for the SnapURL Web UI. It is a single-page application built with React and Vite.

## Features

- **Full CRUD Operations:** Create, read, update, and delete short links.
- **QR Code Generation:** Instantly generate a QR code for any short link.
- **Configurable Hostname:** Set your short link domain directly in the UI (persisted in browser storage).
- **UTM Parameter Support:** Add `utm_source`, `utm_medium`, and `utm_campaign` parameters when creating links.
- **Search and Refresh:** Easily find links across all pages and refresh the local cache from Cloudflare KV.
- **URL Validation:** Real-time validation of long URLs for reachability and format.
- **Enhanced User Feedback:** Improved error messages and notifications for a smoother user experience.
- **Pagination:** Navigate through large sets of short URLs with customizable items per page.

## Development

To run the client in development mode, navigate to the `web-ui/client` directory and run:

```bash
npm install
npm run dev
```

This will start the Vite development server, which typically runs on `http://localhost:5173`.

## Production

To build the client for production, run:

```bash
npm run build
```

This will create a `dist` directory with the optimized, static files.

## License

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](../LICENSE) file for details.
