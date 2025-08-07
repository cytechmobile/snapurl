
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const CLOUDFLARE_KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
const CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4';

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
		console.log(`fetchFromKVAndCache: Raw value for ${key.name}: ${value}`);
		try {
			const parsedValue = JSON.parse(value);
			console.log(`fetchFromKVAndCache: Parsed value for ${key.name}:`, parsedValue);
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

const createMapping = async (shortCode, longUrl, utm_source, utm_medium, utm_campaign, tags) => {
    const value = JSON.stringify({
        longUrl,
        utm_source: utm_source || '',
        utm_medium: utm_medium || '',
        utm_campaign: utm_campaign || '',
        tags: tags || [],
    });
    console.log(`createMapping: Sending to KV for ${shortCode}: ${value}`);

    await makeCloudflareApiCall(
        'PUT',
        `/accounts/${CLOUDFLARE_ACCOUNT_ID}/storage/kv/namespaces/${CLOUDFLARE_KV_NAMESPACE_ID}/values/${shortCode}`,
        value
    );
};

const updateMapping = async (shortCode, longUrl, utm_source, utm_medium, utm_campaign, tags) => {
    const value = JSON.stringify({
        longUrl,
        utm_source: utm_source || '',
        utm_medium: utm_medium || '',
        utm_campaign: utm_campaign || '',
        tags: tags || [],
    });
    console.log(`updateMapping: Sending to KV for ${shortCode}: ${value}`);

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
