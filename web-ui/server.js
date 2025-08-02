const express = require('express');
const { execSync } = require('child_process');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch'); // Import node-fetch
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 3001;

const projectRoot = path.resolve(__dirname, '..');
const csvPath = path.join(projectRoot, 'url-mappings.csv');
const clientBuildPath = path.join(__dirname, 'client', 'dist');

// --- Dynamic Configuration ---
let WRANGLER_NAMESPACE_ID;
try {
  const wranglerConfigPath = path.join(projectRoot, 'wrangler.jsonc');
  const wranglerConfig = fs.readFileSync(wranglerConfigPath, 'utf8');
  // A simple regex to strip comments, as JSON.parse can't handle them.
  const jsonc = wranglerConfig.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => g ? "" : m);
  const config = JSON.parse(jsonc);
  
  // Dynamically use the *first* KV namespace defined in the config.
  const kvBinding = config.kv_namespaces?.[0];
  
  if (!kvBinding || !kvBinding.id) {
    throw new Error("Could not find a valid KV namespace binding in wrangler.jsonc. Please ensure at least one is defined with an 'id'.");
  }
  WRANGLER_NAMESPACE_ID = kvBinding.id;
  console.log(`Successfully loaded KV Namespace ID: ${WRANGLER_NAMESPACE_ID} (from binding '${kvBinding.binding}')`);
} catch (error) {
  console.error("FATAL: Could not load configuration from wrangler.jsonc.", error);
  process.exit(1); // Exit if configuration is missing.
}

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Wrangler Helpers ---
const runWrangler = (command) => {
  try {
    const fullCommand = `${command} --remote --config wrangler.jsonc`;
    const output = execSync(fullCommand, { encoding: 'utf8', cwd: projectRoot });
    return { success: true, data: output };
  } catch (error) {
    return { success: false, error: error.stderr || error.message };
  }
};

const fetchFromKVAndCache = async () => {
  const listCommand = `wrangler kv key list --namespace-id ${WRANGLER_NAMESPACE_ID}`;
  const listResult = runWrangler(listCommand);
  if (!listResult.success) throw new Error('Failed to list keys from Cloudflare KV.');
  const keys = JSON.parse(listResult.data);
  if (!Array.isArray(keys)) throw new Error('Wrangler returned an unexpected format for keys.');
  const mappings = [];
  for (const key of keys) {
    const getCommand = `wrangler kv key get "${key.name}" --namespace-id ${WRANGLER_NAMESPACE_ID}`;
    const getResult = runWrangler(getCommand);
    if (getResult.success) {
      try {
        const value = JSON.parse(getResult.data);
        mappings.push({ shortCode: key.name, longUrl: value.longUrl });
      } catch (e) {
        mappings.push({ shortCode: key.name, longUrl: getResult.data.trim() });
      }
    }
  }
  const csvContent = ['Short Code,Long URL,UTM Source,UTM Medium,UTM Campaign', ...mappings.map(m => {
    const longUrl = m.longUrl.replace(/"/g, '""'); // Escape double quotes
    return `"${m.shortCode}","${longUrl}","${m.utm_source || ''}","${m.utm_medium || ''}","${m.utm_campaign || ''}"`;
  })];
  fs.writeFileSync(csvPath, csvContent.join('\n'));
  return mappings;
};

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

  const command = `wrangler kv key put "${shortCode}" '${value}' --namespace-id ${WRANGLER_NAMESPACE_ID}`;
  const result = runWrangler(command);

  if (result.success) {
    await fetchFromKVAndCache(); // Update CSV cache
    res.status(201).json({ success: true, data: { shortCode, longUrl } });
  } else {
    res.status(500).json({ success: false, error: `Failed to create short URL: ${result.error}` });
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

  const command = `wrangler kv key put "${shortCode}" '${value}' --namespace-id ${WRANGLER_NAMESPACE_ID}`;
  const result = runWrangler(command);

  if (result.success) {
    await fetchFromKVAndCache(); // Update CSV cache
    res.json({ success: true, data: { shortCode, longUrl } });
  } else {
    res.status(500).json({ success: false, error: `Failed to update short URL: ${result.error}` });
  }
});

apiRouter.delete('/mappings/:shortCode', async (req, res) => {
  const { shortCode } = req.params;
  if (!shortCode) return res.status(400).json({ success: false, error: 'Short code is required.' });
  const command = `wrangler kv key delete "${shortCode}" --namespace-id ${WRANGLER_NAMESPACE_ID}`;
  const result = runWrangler(command);
  if (result.success) {
    await fetchFromKVAndCache(); // Update CSV cache
    res.json({ success: true });
  } else {
    res.status(500).json({ success: false, error: `Failed to delete short URL: ${result.error}` });
  }
});

// New API endpoint for URL validation
apiRouter.get('/validate-url', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ isValid: false, message: 'URL parameter is required.' });
  }

  try {
    const response = await fetch(url, { method: 'HEAD', timeout: 5000 }); // 5-second timeout
    if (response.ok) {
      res.json({ isValid: true, message: `URL is reachable (Status: ${response.status})` });
    } else {
      res.json({ isValid: false, message: `URL returned an error status: ${response.status}` });
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      res.json({ isValid: false, message: 'URL validation timed out.' });
    } else {
      res.json({ isValid: false, message: `Could not reach URL: ${error.message}` });
    }
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