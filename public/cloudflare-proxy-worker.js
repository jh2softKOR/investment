// Cloudflare Workers proxy to bypass CORS for free-market APIs used in the dark economy widget.
// Deploy with `wrangler deploy` after placing this file in your Worker project.
const ALLOWED_HOSTS = [
  'api.metals.live',
  'stooq.com',
  'api.exchangerate.host'
];

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');

    if (!target) {
      return new Response('Missing "url" query parameter', { status: 400 });
    }

    let upstreamUrl;
    try {
      upstreamUrl = new URL(target);
    } catch (error) {
      return new Response('Invalid target URL', { status: 400 });
    }

    if (!ALLOWED_HOSTS.includes(upstreamUrl.hostname)) {
      return new Response('Requested host is not allowed', { status: 403 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(request.headers)
      });
    }

    const proxiedRequest = new Request(upstreamUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'follow'
    });

    const upstreamResponse = await fetch(proxiedRequest);
    const headers = buildCorsHeaders(request.headers, upstreamResponse.headers);

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers
    });
  }
};

function buildCorsHeaders(requestHeaders, upstreamHeaders = new Headers()) {
  const headers = new Headers(upstreamHeaders);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  const requestedHeaders = requestHeaders.get('Access-Control-Request-Headers');
  headers.set('Access-Control-Allow-Headers', requestedHeaders || '*');
  headers.delete('content-security-policy');
  headers.delete('content-security-policy-report-only');
  return headers;
}
