const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cookieParser = require('cookie-parser');
const { fetchFromKVAndCache, createMapping, updateMapping, deleteMapping } = require('./src/cloudflare-api');

require('dotenv').config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 3001;

const projectRoot = path.resolve(__dirname, '..');
const csvPath = path.join(projectRoot, 'url-mappings.csv');
const clientBuildPath = path.join(__dirname, 'client', 'dist');

// --- Dynamic Configuration ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const AUTHORIZED_GOOGLE_EMAILS = process.env.AUTHORIZED_GOOGLE_EMAILS ? process.env.AUTHORIZED_GOOGLE_EMAILS.split(',') : [];

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !SESSION_SECRET) {
	console.error(
		'FATAL: Missing required environment variables. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET, and AUTHORIZED_GOOGLE_EMAILS.'
	);
	process.exit(1);
}

app.use(cookieParser());
app.use(session({
	secret: SESSION_SECRET,
	resave: false,
	saveUninitialized: false,
	cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  },
  function(accessToken, refreshToken, profile, cb) {
    // Store accessToken on the profile object so it's available for logout
    profile.accessToken = accessToken;
    return cb(null, profile);
  }
));

passport.serializeUser(function(user, cb) {
  cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
  cb(null, obj);
});

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Authentication Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'consent' }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication, redirect home.
    res.redirect('/');
  }
);

app.get('/auth/logout', (req, res, next) => {
  if (req.user && req.user.accessToken) {
    // Revoke the Google Access Token
    fetch(`https://oauth2.googleapis.com/revoke?token=${req.user.accessToken}`,
      { method: 'POST' }
    ).then(() => {
      req.logout((err) => {
        if (err) { return next(err); }
        req.session.destroy((err) => {
          if (err) { return next(err); }
          res.redirect('/');
        });
      });
    }).catch((error) => {
      console.error('Error revoking Google token:', error);
      // Still proceed with local logout even if token revocation fails
      req.logout((err) => {
        if (err) { return next(err); }
        req.session.destroy((err) => {
          if (err) { return next(err); }
          res.redirect('/');
        });
      });
    });
  } else {
    // If no access token, just proceed with local logout
    req.logout((err) => {
      if (err) { return next(err); }
      req.session.destroy((err) => {
        if (err) { return next(err); }
        res.redirect('/');
      });
    });
  }
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    // Check if the authenticated user's email is in the authorized list
    const userEmail = req.user.emails && req.user.emails.length > 0 ? req.user.emails[0].value : null;
    if (userEmail && AUTHORIZED_GOOGLE_EMAILS.includes(userEmail)) {
      return next(); // User is authenticated AND authorized
    } else {
      // User is authenticated but NOT authorized
      return res.status(403).json({ success: false, error: 'Forbidden. You are authenticated but not authorized to access this application.' });
    }
  }
  // User is not authenticated
  res.status(401).json({ success: false, error: 'Unauthorized. Please log in.' });
}

// --- API Routes ---
const apiRouter = express.Router();
apiRouter.get('/mappings', isAuthenticated, async (req, res) => {
	const forceRefresh = req.query.force === 'true';
	if (!forceRefresh && fs.existsSync(csvPath)) {
		const csvContent = fs.readFileSync(csvPath, 'utf8');
		const lines = csvContent.split('\n').slice(1);
		const mappings = lines
			.map((line) => {
				const [shortCode, longUrl, utm_source, utm_medium, utm_campaign] = line
					.split(',')
					.map((s) => s.replace(/^"|"$/g, '').replace(/""/g, '"'));
				return { shortCode, longUrl, utm_source, utm_medium, utm_campaign };
			})
			.filter((m) => m.shortCode && m.longUrl);
		return res.json({ success: true, data: mappings });
	}
	try {
		const mappings = await fetchFromKVAndCache();
		res.json({ success: true, data: mappings });
	} catch (error) {
		res.status(500).json({ success: false, error: error.message });
	}
});
apiRouter.post('/mappings', isAuthenticated, async (req, res) => {
	const { shortCode, longUrl, utm_source, utm_medium, utm_campaign } = req.body;

	if (!shortCode || !longUrl) {
		return res.status(400).json({ success: false, error: 'Short code and long URL are required.' });
	}
	const urlRegex =
		/^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/i;
	if (!urlRegex.test(longUrl)) {
		return res.status(400).json({ success: false, error: 'Please enter a valid long URL.' });
	}

	try {
		await createMapping(shortCode, longUrl, utm_source, utm_medium, utm_campaign );
		await fetchFromKVAndCache(); // Update CSV cache
		res.status(201).json({ success: true, data: { shortCode, longUrl } });
	} catch (error) {
		res.status(500).json({ success: false, error: `Failed to create short URL: ${error.message}` });
	}
});
apiRouter.put('/mappings/:shortCode', isAuthenticated, async (req, res) => {
	const { shortCode } = req.params;
	const { longUrl, utm_source, utm_medium, utm_campaign } = req.body;
	if (!shortCode || !longUrl) {
		return res.status(400).json({ success: false, error: 'Short code and long URL are required.' });
	}
	const urlRegex =
		/^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/i;
	if (!urlRegex.test(longUrl)) {
		return res.status(400).json({ success: false, error: 'Please enter a valid long URL.' });
	}

	try {
		await updateMapping(shortCode, longUrl, utm_source, utm_medium, utm_campaign );
		await fetchFromKVAndCache(); // Update CSV cache
		res.json({ success: true, data: { shortCode, longUrl } });
	} catch (error) {
		res.status(500).json({ success: false, error: `Failed to update short URL: ${error.message}` });
	}
});

apiRouter.delete('/mappings/:shortCode', isAuthenticated, async (req, res) => {
	const { shortCode } = req.params;
	if (!shortCode) return res.status(400).json({ success: false, error: 'Short code is required.' });
	try {
		await deleteMapping(shortCode);
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

// New API endpoint to get user information
app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: { id: req.user.id, displayName: req.user.displayName } });
  } else {
    res.json({ user: null });
  }
});

app.use('/api', apiRouter);

// --- Frontend Serving ---
// Protect the root path, redirecting to login if not authenticated
app.get('/', (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/auth/google');
  }
  next(); // Continue to serve the static files if authenticated
});

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
