import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCss, PROXY_TIMEOUT_MS } from './cssImport.ts';

// A stylesheet URL with a query string, so these tests also pin the proxy
// query encoding rather than just the happy path.
const TARGET = 'https://cdn.example/tokens.css?family=a&v=1';
const PROXY = `/api/fetch-css?url=${encodeURIComponent(TARGET)}`;

const css = (body: string) =>
  new Response(body, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
const html = (status = 200) =>
  new Response('<!doctype html><html></html>', { status, headers: { 'content-type': 'text/html' } });
const jsonError = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('fetchCss', () => {
  it('uses the proxy response and never touches the direct URL when the route answers', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        seen.push(String(input));
        return css('--via-proxy: 1;');
      }),
    );

    await expect(fetchCss(TARGET)).resolves.toBe('--via-proxy: 1;');
    expect(seen).toEqual([PROXY]);
  });

  it('falls back to the direct fetch when a static/SPA host answers the route with index.html', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        seen.push(url);
        return url === PROXY ? html() : css('--direct: 1;');
      }),
    );

    await expect(fetchCss(TARGET)).resolves.toBe('--direct: 1;');
    expect(seen).toEqual([PROXY, TARGET]);
  });

  it('falls back when there is no server at all (the proxy attempt rejects)', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        seen.push(url);
        if (url === PROXY) throw new TypeError('Failed to fetch');
        return css('--direct: 2;');
      }),
    );

    await expect(fetchCss(TARGET)).resolves.toBe('--direct: 2;');
    expect(seen).toEqual([PROXY, TARGET]);
  });

  it('falls back when a static host answers the absent route with an HTML 404', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        seen.push(url);
        return url === PROXY ? html(404) : css('--direct: 3;');
      }),
    );

    await expect(fetchCss(TARGET)).resolves.toBe('--direct: 3;');
    expect(seen).toEqual([PROXY, TARGET]);
  });

  it("falls back when a static host's absent route answers with a JSON 404", async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        seen.push(url);
        return url === PROXY ? jsonError(404, 'not found') : css('--direct: json404;');
      }),
    );

    await expect(fetchCss(TARGET)).resolves.toBe('--direct: json404;');
    expect(seen).toEqual([PROXY, TARGET]);
  });

  it('falls back on a non-JSON 4xx (not the route answering)', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        seen.push(url);
        return url === PROXY
          ? new Response('<!doctype html><html></html>', {
              status: 400,
              headers: { 'content-type': 'text/html' },
            })
          : css('--direct: html400;');
      }),
    );

    await expect(fetchCss(TARGET)).resolves.toBe('--direct: html400;');
    expect(seen).toEqual([PROXY, TARGET]);
  });

  it("surfaces the proxy's upstream status instead of retrying the CORS-prone direct fetch", async () => {
    const fetchMock = vi.fn(async () => jsonError(502, 'upstream 404 Not Found'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCss(TARGET)).rejects.toThrow('upstream 404 Not Found');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces a non-JSON 5xx proxy response instead of retrying direct', async () => {
    const fetchMock = vi.fn(async () => html(500));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCss(TARGET)).rejects.toThrow('proxy error: 500');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aborts a hung proxy attempt and falls back to the direct fetch', async () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        seen.push(url);
        if (url !== PROXY) return Promise.resolve(css('--direct: abort;'));
        // Never answers on its own; rejects only once the attempt is aborted.
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
      }),
    );

    const pending = fetchCss(TARGET);
    await vi.advanceTimersByTimeAsync(PROXY_TIMEOUT_MS);

    await expect(pending).resolves.toBe('--direct: abort;');
    expect(seen).toEqual([PROXY, TARGET]);
  });

  it("surfaces the proxy's own rejection (bad protocol) without retrying", async () => {
    const fetchMock = vi.fn(async () => jsonError(400, 'only http/https urls are supported'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCss('file:///C:/Windows/win.ini')).rejects.toThrow(
      'only http/https urls are supported',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps today's CORS message when both attempts fail at the network level", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCss(TARGET)).rejects.toThrow(
      'blocked (the URL must allow cross-origin requests)',
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps a reachable host's real HTTP status when both attempts fail", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input) === PROXY
          ? html(404)
          : new Response('nope', { status: 404, statusText: 'Not Found' }),
      ),
    );

    await expect(fetchCss(TARGET)).rejects.toThrow('404 Not Found');
  });
});
