import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

addEventListener('fetch', (event) => {
  event.respondWith(handleEvent(event));
});

async function handleEvent(event) {
  try {
    return await getAssetFromKV(event);
  } catch (e) {
    // If the asset is not found, serve the main index.html for single-page apps.
    try {
      return await getAssetFromKV(event, {
        mapRequestToAsset: (req) => new Request(`${new URL(req.url).origin}/index.html`, req),
      });
    } catch (e) {
      return new Response('Not found', { status: 404 });
    }
  }
}
