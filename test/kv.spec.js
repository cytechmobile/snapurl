import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src';

describe('URL Shortener Worker', () => {
  beforeEach(async () => {
    // Clear all keys from the KV namespace
    const { keys } = await env.racket_shortener.list();
    const promises = keys.map((key) => env.racket_shortener.delete(key.name));
    await Promise.all(promises);
  });

  it('should redirect root to racket.gr', async () => {
    const request = new Request('http://example.com/');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://racket.gr/');
  });

  it('should redirect a valid short code to the long URL', async () => {
    await env.racket_shortener.put('test-code', 'https://example.com/long-url');

    const request = new Request('http://example.com/test-code');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://example.com/long-url');
  });

  it('should redirect to racket.gr for a non-existent short code', async () => {
    const request = new Request('http://example.com/non-existent-code');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://racket.gr/');
  });

  it('should handle integration-style requests for valid short codes', async () => {
    await env.racket_shortener.put('integration-test', 'https://integration.example.com');

    const request = new Request('http://example.com/integration-test');
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://integration.example.com/');
  });
});
