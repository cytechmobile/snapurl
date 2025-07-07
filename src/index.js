// src/index.js (or src/index.ts)
import { nanoid } from 'nanoid';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- Handle POST requests to /create for generating new short links ---
    if (request.method === "POST" && path === "/create") {
      try {
        const { longUrl, customShortCode } = await request.json();

        if (!longUrl || !longUrl.startsWith("http")) {
          return new Response("Invalid URL provided. Must start with http:// or https://", { status: 400 });
        }

        let shortCode = customShortCode;
        if (!shortCode) {
          do {
            shortCode = nanoid(6); // Generate a 6-character random ID
          } while (await env.racket_shortener.get(shortCode)); // Ensure it's not already used
        } else {
            // Check if custom short code is already in use
            if (await env.racket_shortener.get(shortCode)) {
                return new Response("Custom short code already in use", { status: 409 });
            }
        }

        await env.racket_shortener.put(shortCode, longUrl); // No expirationTtl for simplicity here

        const shortenedUrl = `${url.origin}/${shortCode}`;
        return new Response(JSON.stringify({ shortUrl: shortenedUrl }), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        });
      } catch (error) {
        console.error("Error creating short URL:", error);
        return new Response("Error creating short URL", { status: 500 });
      }
    }

    // --- Handle GET/other requests for proxying short links ---
    const shortCode = path.slice(1); // Remove leading slash

    if (shortCode === "") {
        // Handle requests to the root of your shortener domain (e.g., s.yourdomain.com/)
        // You can return a custom landing page, or proxy a default site, or a 404
        //return new Response("Welcome to the Proxy Link Shortener! Append a short code to the URL.", { status: 200 });
        // Or to proxy a default site:
         return fetch("https://racket.gr", request);
    }

    try {
      const longUrl = await env.racket_shortener.get(shortCode);

      if (longUrl) {
        // Construct a new request to the long URL, preserving original method, headers, body etc.
        // This is crucial for proper proxying, especially for POST requests, etc.
        const proxyRequest = new Request(longUrl + url.search, request); // Append original query parameters

        // Fetch the content from the long URL
        const response = await fetch(proxyRequest);

        // Return the response directly to the client
        // Cloudflare Workers automatically handle streaming the body and
        // copying headers (with some security exceptions)
        return response;

      } else {
        // Short code not found
        return new Response("Short URL not found", { status: 404 });
      }
    } catch (error) {
      console.error("Error proxying request:", error);
      // More specific error handling could be added here, e.g., if the longUrl itself is down
      return new Response("Error proxying content. The target site might be down or inaccessible.", { status: 502 }); // Bad Gateway
    }
  },
};
