# Racket URL Manager

A Terminal User Interface (TUI) for managing Racket URL Shortener mappings.

## Features

- 📋 **List all URL mappings** - View all your short URLs and their destinations
- ➕ **Create new short URLs** - Add new mappings with custom or auto-generated codes  
- 🔍 **Search mappings** - Find URLs by searching short codes or long URLs
- 💾 **Export to CSV** - Save all mappings to a spreadsheet-compatible file
- ⚙️ **Configurable settings** - Customize worker URL and CSV file location

## Installation

### Option 1: Direct Installation (Recommended)

```bash
# Clone or download the short-url-manager folder
cd short-url-manager

# Install dependencies
npm install

# Install and authenticate Wrangler CLI (if not already done)
npm install -g wrangler
wrangler auth login

# Run the application
npm start
```

### Option 2: Global Installation

```bash
cd short-url-manager
npm install -g .

# Now you can run from anywhere
short-url-manager
```

## Usage

### Basic Usage

```bash
npm start
```

The TUI will start and guide you through the available options using an interactive menu.

### Configuration

You can customize the application using environment variables:

```bash
# Custom worker URL
RACKET_WORKER_URL=https://your-worker.workers.dev npm start

# Custom CSV file location  
RACKET_CSV_FILE=./my-mappings.csv npm start

# Both together
RACKET_WORKER_URL=https://your-worker.workers.dev RACKET_CSV_FILE=./custom.csv npm start
```

### Menu Options

1. **📋 List all URL mappings** - Shows all current short URL → long URL mappings
2. **➕ Create new short URL** - Create a new short URL with optional custom code
3. **🔍 Search mappings** - Search through existing mappings
4. **💾 Export to CSV** - Save all mappings to a CSV file
5. **⚙️ Settings** - View current configuration
6. **🚪 Exit** - Close the application

## Requirements

- Node.js 18.0.0 or higher
- **Wrangler CLI** installed and authenticated
- **Cloudflare account access** to the my-url-shortener project

## How It Works

This TUI application connects directly to your Cloudflare KV storage using the Wrangler CLI:

- **📋 List URLs:** Uses `wrangler kv key list` to fetch all short codes
- **➕ Create URLs:** Uses `wrangler kv key put` to store new mappings  
- **🔍 Search:** Searches through locally cached data
- **💾 Export:** Saves current mappings to CSV file

## Configuration Files

The application will look for and create these files in your current directory:

- `url-mappings.csv` - Stores your URL mappings locally (auto-created/updated)
- Uses Cloudflare KV namespace: `bb0b757c25914a818f3d0c146371d780`

## Authentication Setup

### First-time Setup

1. **Install Wrangler CLI:**
   ```bash
   npm install -g wrangler
   ```

2. **Authenticate with Cloudflare:**
   ```bash
   wrangler auth login
   ```
   This will open a browser window to log into your Cloudflare account.

3. **Verify access:**
   ```bash
   wrangler kv namespace list
   ```
   You should see the `my_shortener_kv` namespace listed.

### For Team Members

To use this TUI, team members need:
1. **Cloudflare account access** to the my-url-shortener project
2. **Appropriate permissions** to read/write the KV namespace
3. **Wrangler authentication** completed (see steps above)

## Troubleshooting

### "Error loading from Cloudflare KV" messages

- Make sure `wrangler` is installed: `npm install -g wrangler`
- Authenticate with Cloudflare: `wrangler auth login`
- Verify you have access to the project: `wrangler kv namespace list`
- Check you're in a directory with proper permissions

### "Error creating short URL" messages

- Ensure wrangler is authenticated: `wrangler auth login`
- Verify you have write permissions to the KV namespace
- Check that the short code doesn't already exist

### "CSV file not found" warning

- This is normal on first run - the CSV file will be created automatically
- You can pre-create the file with headers: `Short URL,Long URL`

### Permission errors

- Make sure you have write permissions in the current directory
- The application needs to read/write the CSV file
- Ensure your Cloudflare account has appropriate KV namespace permissions

## Distribution

To share this application with others:

### For Project Team Members

1. **Zip the entire `short-url-manager` folder**
2. **Share the zip file** with installation instructions
3. **Recipients should:**
   ```bash
   unzip short-url-manager.zip
   cd short-url-manager  
   npm install
   
   # Install and authenticate Wrangler (if not done already)
   npm install -g wrangler
   wrangler auth login
   
   # Run the application
   npm start
   ```

### Important Notes

- **Recipients must have Cloudflare account access** to the my-url-shortener project
- **They need appropriate KV namespace permissions** to read/write URL mappings
- **The application works entirely through Wrangler CLI** - no public API endpoints
- **All operations are authenticated** through their Cloudflare account

## Default Configuration

- **Worker URL:** `https://my-link-shortener.hostmaster-c9c.workers.dev`
- **CSV File:** `./url-mappings.csv` (in current directory)

## Security

This application is designed with security in mind:

- ✅ **No public API endpoints** - all operations go through authenticated Wrangler CLI
- ✅ **Cloudflare account authentication required** - only authorized users can manage URLs
- ✅ **Direct KV access** - bypasses any public worker endpoints
- ✅ **Team-based access control** - managed through Cloudflare account permissions

## Version

Current version: 1.0.0

---

Built for Racket.gr URL Shortener 🔗
