// src/index.js (or src/index.ts)
import { nanoid } from 'nanoid'; // You'll need to install nanoid: npm install nanoid

export default {
  async fetch(request, env, event) { // <-- Make sure to accept the 'event' parameter
    const url = new URL(request.url);
    const path = url.pathname;
    // Handle GET requests for redirection
    const shortCode = path.slice(1); // Remove leading slash

    if (shortCode === "") {
        // Redirect root to your main website or show a landing page
        return Response.redirect("https://racket.gr", 302);
    }
    try {
      const longUrl = await env.racket_shortener.get(shortCode);

      if (longUrl) {
// --- Google Analytics logging code starts here ---
        event.waitUntil(
          logGoogleAnalytics(request, env, shortCode, longUrl)
        );
// --- Google Analytics logging code ends here ---
        return Response.redirect(longUrl, 302);
      } else {
        return Response.redirect("https://racket.gr", 302);
        //return new Response("Short URL not found", { status: 404 });
      }
    } catch (error) {
      console.error("Error fetching from KV:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
// New function to handle the Google Analytics logging
async function logGoogleAnalytics(request, env, shortCode, longUrl) {
  const measurementId = env.GOOGLE_ANALYTICS_MEASUREMENT_ID;
  const apiSecret = env.GOOGLE_ANALYTICS_API_SECRET;

  if (!measurementId || !apiSecret) {
    console.error("Missing Google Analytics credentials. Skipping analytics logging.");
    return;
  }

  // Get user's IP address (Cloudflare's way) to use as the user ID
  const userIp = request.headers.get('cf-connecting-ip') || 'unknown-ip';
  const userAgent = request.headers.get('User-Agent') || 'unknown-user-agent';
  const countryCode = request.cf?.country || 'unknown';
  const regionCodeRaw = request.cf?.regionCode || ''; // Get the raw region code, e.g., 'I'
  const regionId = (countryCode !== 'unknown' && regionCodeRaw !== '') ? `${countryCode}-${regionCodeRaw}` : 'unknown';
  
  // Create a stable client_id by hashing the IP and User-Agent.
  // This is crucial for GA4 to recognize sessions and attribute traffic.
  const uniqueIdentifier = `${userIp}-${userAgent}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(uniqueIdentifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const clientId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Construct the GA4 event payload
  const gaPayload = {
    client_id: clientId,
    events: [
      {
        name: "short_link_access",
        params: {
          // Geo-location data
          country: countryCode,
          region: regionId,
          city: request.cf?.city || 'unknown',
          
          // Standard GA4 parameters
          page_location: request.url,
          page_referrer: request.headers.get('Referer') || 'none',
          engagement_time_msec: 1,

          // Custom dimensions for your reports
          request_hostname: new URL(request.url).hostname,
          link_short_code: shortCode,
          link_longUrl: longUrl,
        }
      }
    ],
  };

  try {
    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": userAgent,
        },
        body: JSON.stringify({
          ...gaPayload,
          uip: userIp, // Pass the user's IP for geo-lookup
        }),
      }
    );

    // For debugging, you can check the response status
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to send GA4 event: ${response.status} - ${errorText}`);
    } else {
      console.log(`GA4 event for '${shortCode}' sent successfully.`);
      console.log(`GAPAYLOD: '${JSON.stringify(gaPayload)}' sent successfully.`);
    }

  } catch (error) {
    console.error("Error sending GA4 event:", error);
  }
}