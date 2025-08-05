
const fs = require('fs');
const path = require('path');

const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
const CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4';

const projectRoot = path.resolve(__dirname, '..', '..');
const csvPath = path.join(projectRoot, 'url-mappings.csv');

async function makeCloudflareApiCall(method, endpoint, body = null) {
	const headers = {
		Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
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
		const errorMessage =
			typeof data === 'object' && data.errors && data.errors[0] && data.errors[0].message
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
			mappings.push({
				shortCode: key.name,
				longUrl: parsedValue.longUrl,
				utm_source: parsedValue.utm_source,
				utm_medium: parsedValue.utm_medium,
				utm_campaign: parsedValue.utm_campaign,
			});
		} catch {
			mappings.push({ shortCode: key.name, longUrl: value.trim() });
		}
	}
	const csvContent = [
		'Short Code,Long URL,UTM Source,UTM Medium,UTM Campaign',
		...mappings.map((m) => {
			const longUrl = m.longUrl.replace(/"/g, '""'); // Escape double quotes
			return `"${m.shortCode}","${longUrl}","${m.utm_source || ''}","${m.utm_medium || ''}","${m.utm_campaign || ''}"`;
		}),
	];
	fs.writeFileSync(csvPath, csvContent.join('\n'));
	return mappings;
};

const createMapping = async (shortCode, longUrl, utm_source, utm_medium, utm_campaign) => {
    const value = JSON.stringify({
        longUrl,
        utm_source: utm_source || '',
        utm_medium: utm_medium || '',
        utm_campaign: utm_campaign || '',
    });

    await makeCloudflareApiCall(
        'PUT',
        `/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${shortCode}`,
        value
    );
};

const updateMapping = async (shortCode, longUrl, utm_source, utm_medium, utm_campaign) => {
    const value = JSON.stringify({
        longUrl,
        utm_source: utm_source || '',
        utm_medium: utm_medium || '',
        utm_campaign: utm_campaign || '',
    });

    await makeCloudflareApiCall(
        'PUT',
        `/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${shortCode}`,
        value
    );
};

const deleteMapping = async (shortCode) => {
    await makeCloudflareApiCall(
        'DELETE',
        `/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${shortCode}`
    );
};


module.exports = {
    fetchFromKVAndCache,
    createMapping,
    updateMapping,
    deleteMapping,
};
