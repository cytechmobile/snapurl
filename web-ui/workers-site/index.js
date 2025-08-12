export default {
  async fetch(request, env, ctx) {
    try {
      // Try to serve the static asset using the ASSETS binding.
      // The ASSETS binding is automatically provided by Cloudflare Workers
      // when you configure [assets] in wrangler.toml.
      return await env.ASSETS.fetch(request);
    } catch (e) {
      // If the asset is not found, serve the main index.html for single-page apps.
      // This is a common pattern for SPAs where all routes should fall back to index.html.
      try {
        const url = new URL(request.url);
        // Construct a new request to index.html.
        const indexRequest = new Request(`${url.origin}/index.html`, request);
        return await env.ASSETS.fetch(indexRequest);
      } catch (e) {
        // If even index.html is not found, return a 404.
        return new Response('Not found', { status: 404 });
      }
    }
  },
};