const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
// const fetch = require('node-fetch'); // Import node-fetch - Removed as it causes issues with CommonJS
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 3001;

const projectRoot = path.resolve(__dirname, '..');
const csvPath = path.join(projectRoot, 'url-mappings.csv');
const clientBuildPath = path.join(__dirname, 'client', 'dist');

// --- Dynamic Configuration ---
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
const CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4';

if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_KV_NAMESPACE_ID) {
  console.error("FATAL: Missing Cloudflare API credentials. Please set CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, and CLOUDFLARE_KV_NAMESPACE_ID environment variables.");
  process.exit(1);
}

async function makeCloudflareApiCall(method, endpoint, body = null) {
  const headers = {
    'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
    'Content-Type': 'application/json',
  };

  const url = `${CLOUDFLARE_API_BASE_URL}${endpoint}`;
  const options = { method, headers };

  if (body !== null) {
    options.body = typeof body === 'object' ? JSON.stringify(body) : body;
  }

  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type');
  let data;

  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    // If it's a JSON error, use its message; otherwise, use the raw text or status
    const errorMessage = (typeof data === 'object' && data.errors && data.errors[0] && data.errors[0].message)
      ? data.errors[0].message
      : `Cloudflare API error: ${response.status} - ${data}`;
    throw new Error(errorMessage);
  }

  return data.result || data; // Return data.result if it exists, otherwise return data
}

const fetchFromKVAndCache = async () => {
  const listKeysEndpoint = `/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/keys`;
  const keysResult = await makeCloudflareApiCall('GET', listKeysEndpoint);
  const mappings = [];

  for (const key of keysResult) {
    const getValueEndpoint = `/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${key.name}`;
    const value = await makeCloudflareApiCall('GET', getValueEndpoint);
    try {
      const parsedValue = JSON.parse(value);
      mappings.push({ shortCode: key.name, longUrl: parsedValue.longUrl, utm_source: parsedValue.utm_source, utm_medium: parsedValue.utm_medium, utm_campaign: parsedValue.utm_campaign });
    } catch (e) {
      mappings.push({ shortCode: key.name, longUrl: value.trim() });
    }
  }
  const csvContent = ['Short Code,Long URL,UTM Source,UTM Medium,UTM Campaign', ...mappings.map(m => {
    const longUrl = m.longUrl.replace(/"/g, '""'); // Escape double quotes
    return `"${m.shortCode}","${longUrl}","${m.utm_source || ''}","${m.utm_medium || ''}","${m.utm_campaign || ''}"`;
  })];
  fs.writeFileSync(csvPath, csvContent.join('\n'));
  return mappings;
};

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- API Routes ---
const apiRouter = express.Router();
apiRouter.get('/mappings', async (req, res) => {
  const forceRefresh = req.query.force === 'true';
  if (!forceRefresh && fs.existsSync(csvPath)) {
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n').slice(1);
    const mappings = lines.map(line => {
      const [shortCode, longUrl, utm_source, utm_medium, utm_campaign] = line.split(',').map(s => s.replace(/^"|"$/g, '').replace(/""/g, '"'));
      return { shortCode, longUrl, utm_source, utm_medium, utm_campaign };
    }).filter(m => m.shortCode && m.longUrl);
    return res.json({ success: true, data: mappings });
  }
  try {
    const mappings = await fetchFromKVAndCache();
    res.json({ success: true, data: mappings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
apiRouter.post('/mappings', async (req, res) => {
  const { shortCode, longUrl, utm_source, utm_medium, utm_campaign } = req.body;
  if (!shortCode || !longUrl) {
    return res.status(400).json({ success: false, error: 'Short code and long URL are required.' });
  }
  const urlRegex = /^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/i;
  if (!urlRegex.test(longUrl)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid long URL.' });
  }

  // Store the data as a JSON object
  const value = JSON.stringify({
    longUrl,
    utm_source: utm_source || '',
    utm_medium: utm_medium || '',
    utm_campaign: utm_campaign || '',
  });

  try {
    await makeCloudflareApiCall('PUT', `/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${shortCode}`, value);
    await fetchFromKVAndCache(); // Update CSV cache
    res.status(201).json({ success: true, data: { shortCode, longUrl } });
  } catch (error) {
    res.status(500).json({ success: false, error: `Failed to create short URL: ${error.message}` });
  }
});
apiRouter.put('/mappings/:shortCode', async (req, res) => {
  const { shortCode } = req.params;
  const { longUrl, utm_source, utm_medium, utm_campaign } = req.body;
  if (!shortCode || !longUrl) {
    return res.status(400).json({ success: false, error: 'Short code and long URL are required.' });
  }
  const urlRegex = /^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/i;
  if (!urlRegex.test(longUrl)) {
    return res.status(400).json({ success: false, error: 'Please enter a valid long URL.' });
  }

  // Store the data as a JSON object
  const value = JSON.stringify({
    longUrl,
    utm_source: utm_source || '',
    utm_medium: utm_medium || '',
    utm_campaign: utm_campaign || '',
  });

  try {
    await makeCloudflareApiCall('PUT', `/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${shortCode}`, value);
    await fetchFromKVAndCache(); // Update CSV cache
    res.json({ success: true, data: { shortCode, longUrl } });
  } catch (error) {
    res.status(500).json({ success: false, error: `Failed to update short URL: ${error.message}` });
  }
});

apiRouter.delete('/mappings/:shortCode', async (req, res) => {
  const { shortCode } = req.params;
  if (!shortCode) return res.status(400).json({ success: false, error: 'Short code is required.' });
  try {
    await makeCloudflareApiCall('DELETE', `/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${shortCode}`);
    await fetchFromKVAndCache(); // Update CSV cache
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: `Failed to delete short URL: ${error.message}` });
  }
});

// New API endpoint for URL validation
apiRouter.get('/validate-url', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ isValid: false, message: 'URL parameter is required.' });
  }

  try {
    const { default: fetch } = await import('node-fetch'); // Dynamic import
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5-second timeout

    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      res.json({ isValid: true, message: `URL is reachable (Status: ${response.status})` });
    } else {
      res.json({ isValid: false, message: `URL returned an error status: ${response.status}` });
    }
  } catch (error) {
    let message = 'Could not reach URL. Please check the address and try again.';
    if (error.name === 'AbortError') {
      message = 'URL validation timed out. The server took too long to respond.';
    } else if (error.code === 'ENOTFOUND') {
      message = 'The domain name could not be resolved. Please check for typos.';
    } else if (error.code === 'ECONNREFUSED') {
      message = 'The connection was refused. The server might be down or the URL is incorrect.';
    }
    res.json({ isValid: false, message: message });
  }
});

app.use('/api', apiRouter);

// --- Frontend Serving ---
app.use(express.static(clientBuildPath));

// --- Final Fallback Middleware (replaces the problematic app.get('*')) ---
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/') && !path.extname(req.path)) {
    res.sendFile(path.join(clientBuildPath, 'index.html'), (err) => {
      if (err) {
        res.status(500).send(err);
      }
    });
  } else {
    next();
  }
});

// --- Start Server ---
// Ensure CSV is populated on server startup
(async () => {
  try {
    console.log('Populating CSV cache from Cloudflare KV on server startup...');
    await fetchFromKVAndCache();
    console.log('CSV cache populated successfully.');
  } catch (error) {
    console.error('Failed to populate CSV cache on startup:', error.message);
  }

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
})();