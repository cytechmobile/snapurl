export default {
  fetch(request, env, ctx) {
    // Trivial change to force redeployment
    console.log('Handling request for:', request.url);
    return handleRequest(request, env);
  },
};

async function handleRequest(request, env) {
  const allowedOrigin = env.CORS_ALLOWED_ORIGIN;
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cf-Access-Jwt-Assertion',
    'Access-Control-Allow-Credentials': 'true',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const response = await (async () => {
    console.log('Environment variables (env):', env);
    const url = new URL(request.url);

    // KV interaction functions
    const fetchFromKV = async (env) => {
      const { keys } = await env.SNAPURL_KV.list();
      const mappings = [];

      for (const key of keys) {
        const value = await env.SNAPURL_KV.get(key.name);
        try {
          const parsedValue = JSON.parse(value);
          mappings.push({
            shortCode: key.name,
            longUrl: parsedValue.longUrl,
            utm_source: parsedValue.utm_source,
            utm_medium: parsedValue.utm_medium,
            utm_campaign: parsedValue.utm_campaign,
            tags: parsedValue.tags || [],
          });
        } catch {
          mappings.push({ shortCode: key.name, longUrl: value.trim(), tags: [] });
        }
      }
      return mappings;
    };

    const createMapping = async (env, shortCode, longUrl, utm_source, utm_medium, utm_campaign, tags) => {
      const value = JSON.stringify({
        longUrl,
        utm_source: utm_source || '',
        utm_medium: utm_medium || '',
        utm_campaign: utm_campaign || '',
        tags: tags || [],
      });
      await env.SNAPURL_KV.put(shortCode, value);
    };

    const updateMapping = async (env, shortCode, longUrl, utm_source, utm_medium, utm_campaign, tags) => {
      const value = JSON.stringify({
        longUrl,
        utm_source: utm_source || '',
        utm_medium: utm_medium || '',
        utm_campaign: utm_campaign || '',
        tags: tags || [],
      });
      await env.SNAPURL_KV.put(shortCode, value);
    };

    const deleteMapping = async (env, shortCode) => {
      await env.SNAPURL_KV.delete(shortCode);
    };

    // API Routes
    if (url.pathname.startsWith('/api/mappings')) {
      switch (request.method) {
        case 'GET':
          try {
            const mappings = await fetchFromKV(env);
            return new Response(JSON.stringify({ success: true, data: mappings }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } catch (error) {
            return new Response(JSON.stringify({ success: false, error: error.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        case 'POST':
          try {
            const { shortCode, longUrl, utm_source, utm_medium, utm_campaign, tags } = await request.json();
            if (!shortCode || !longUrl) {
              return new Response(JSON.stringify({ success: false, error: 'Short code and long URL are required.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
            await createMapping(env, shortCode, longUrl, utm_source, utm_medium, utm_campaign, tags);
            return new Response(JSON.stringify({ success: true, data: { shortCode, longUrl } }), {
              status: 201,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } catch (error) {
            return new Response(JSON.stringify({ success: false, error: `Failed to create short URL: ${error.message}` }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        case 'PUT':
          try {
            const shortCode = url.pathname.split('/').pop();
            const { longUrl, utm_source, utm_medium, utm_campaign, tags } = await request.json();
            if (!shortCode || !longUrl) {
              return new Response(JSON.stringify({ success: false, error: 'Short code and long URL are required.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
            await updateMapping(env, shortCode, longUrl, utm_source, utm_medium, utm_campaign, tags);
            return new Response(JSON.stringify({ success: true, data: { shortCode, longUrl } }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } catch (error) {
            return new Response(JSON.stringify({ success: false, error: `Failed to update short URL: ${error.message}` }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        case 'DELETE':
          try {
            const shortCode = url.pathname.split('/').pop();
            if (!shortCode) {
              return new Response(JSON.stringify({ success: false, error: 'Short code is required.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }
            await deleteMapping(env, shortCode);
            return new Response(JSON.stringify({ success: true }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          } catch (error) {
            return new Response(JSON.stringify({ success: false, error: `Failed to delete short URL: ${error.message}` }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        default:
          return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
      }
    } else if (url.pathname === '/api/validate-url') {
      // Handle URL validation
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) {
        return new Response(JSON.stringify({ isValid: false, message: 'URL parameter is required.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

        const response = await fetch(targetUrl, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          return new Response(JSON.stringify({ isValid: true, message: `URL is reachable (Status: ${response.status})` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } else {
          return new Response(JSON.stringify({ isValid: false, message: `URL returned an error status: ${response.status}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (error) {
        let message = 'Could not reach URL. Please check the address and try again.';
        if (error.name === 'AbortError') {
          message = 'URL validation timed out. The server took too long to respond.';
        } else if (error.cause && error.cause.code === 'ENOTFOUND') { // Check error.cause for Node.js-like errors
          message = 'The domain name could not be resolved. Please check for typos.';
        } else if (error.cause && error.cause.code === 'ECONNREFUSED') {
          message = 'The connection was refused. The server might be down or the URL is incorrect.';
        }
        return new Response(JSON.stringify({ isValid: false, message: message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    }
  })();

  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}
