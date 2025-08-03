import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '../src';

describe('URL Shortener Worker', () => {
	beforeEach(async () => {
		// Clear all keys from the KV namespace
		const { keys } = await env.SNAPURL_KV.list();
		const promises = keys.map((key) => env.SNAPURL_KV.delete(key.name));
		await Promise.all(promises);
	});

	it('should redirect root to racket.gr by default', async () => {
		const request = new Request('http://example.com/');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('https://racket.gr/');
	});

	it('should redirect root to custom ROOT_REDIRECT_URL if set', async () => {
		const request = new Request('http://example.com/');
		const customEnv = { ...env, ROOT_REDIRECT_URL: 'https://my-custom-root.com' };
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, customEnv, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('https://my-custom-root.com/');
	});

	it('should redirect a valid short code to the long URL (plain string)', async () => {
		await env.SNAPURL_KV.put('test-code', 'https://example.com/long-url');

		const request = new Request('http://example.com/test-code');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('https://example.com/long-url');
	});

	it('should redirect a valid short code with JSON value and parse UTM params', async () => {
		const jsonValue = JSON.stringify({
			longUrl: 'https://example.com/json-url',
			utm_source: 'test_source',
			utm_medium: 'test_medium',
			utm_campaign: 'test_campaign',
		});
		await env.SNAPURL_KV.put('json-code', jsonValue);

		const request = new Request('http://example.com/json-code');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('https://example.com/json-url');
		// Note: Verifying GA event parameters would require mocking `fetch` within the worker, which is more complex.
	});

	it('should redirect to racket.gr for a non-existent short code', async () => {
		const request = new Request('http://example.com/non-existent-code');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('https://racket.gr/');
	});

	it('should return 500 for KV lookup errors', async () => {
		// Mock the KV namespace to throw an error on get
		const errorEnv = {
			...env,
			SNAPURL_KV: {
				...env.SNAPURL_KV,
				get: vi.fn().mockRejectedValue(new Error('KV lookup failed')),
			},
		};

		const request = new Request('http://example.com/error-code');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, errorEnv, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(500);
		expect(await response.text()).toBe('Internal Server Error');
	});

	it('should handle integration-style requests for valid short codes', async () => {
		await env.SNAPURL_KV.put('integration-test', 'https://integration.example.com');

		const request = new Request('http://example.com/integration-test');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(302);
		expect(response.headers.get('Location')).toBe('https://integration.example.com/');
	});
});
