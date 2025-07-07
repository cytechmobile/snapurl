// src/index.js (or src/index.ts)
import { nanoid } from 'nanoid'; // You'll need to install nanoid: npm install nanoid

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle POST requests to /create for generating new short links
    if (request.method === "POST" && path === "/create") {
      try {
        const { longUrl, customShortCode } = await request.json();

        if (!longUrl || !longUrl.startsWith("http")) {
          return new Response("Invalid URL provided", { status: 400 });
        }

        let shortCode = customShortCode;
        if (!shortCode) {
          // Generate a unique short code if not provided
          do {
            shortCode = nanoid(6); // Generate a 6-character random ID
          } while (await env.racket_shortener.get(shortCode)); // Ensure it's not already used
        } else {
            // Check if custom short code is already in use
            if (await env.racket_shortener.get(shortCode)) {
                return new Response("Custom short code already in use", { status: 409 });
            }
        }

        await env.racket_shortener.put(shortCode, longUrl, {
            // Optional: Set an expiration for the short link (e.g., 30 days)
            // expirationTtl: 60 * 60 * 24 * 30
        });

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

    // Handle GET requests for redirection
    const shortCode = path.slice(1); // Remove leading slash

    if (shortCode === "") {
        // Redirect root to your main website or show a landing page
        return Response.redirect("https://yourmainwebsite.com", 302);
    }

    try {
      const longUrl = await env.racket_shortener.get(shortCode);

      if (longUrl) {
        return Response.redirect(longUrl, 302);
      } else {
        return new Response("Short URL not found", { status: 404 });
      }
    } catch (error) {
      console.error("Error fetching from KV:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
