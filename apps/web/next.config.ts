import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep the classroom scaffold free of automatically generated agent files.
  agentRules: false,
  async rewrites() {
    // Vercel embeds this destination at build time. Redeploy after env changes.
    if (
      (process.env.VERCEL || process.env.NODE_ENV === 'production') &&
      !process.env.API_BASE_URL
    ) {
      throw new Error(
        'Set server-only API_BASE_URL before building production.',
      );
    }
    let backend: URL;
    try {
      backend = new URL(
        process.env.API_BASE_URL ??
          process.env.API_ORIGIN ??
          'http://localhost:4000',
      );
    } catch {
      throw new Error('API_BASE_URL must be a valid backend origin.');
    }
    if (
      !['http:', 'https:'].includes(backend.protocol) ||
      backend.username ||
      backend.password ||
      backend.pathname !== '/' ||
      backend.search ||
      backend.hash ||
      (process.env.VERCEL &&
        (backend.protocol !== 'https:' ||
          ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(
            backend.hostname,
          )))
    ) {
      throw new Error(
        'API_BASE_URL must be an origin only; Vercel requires a public HTTPS backend.',
      );
    }
    return [
      {
        source: '/api/:path*',
        destination: `${backend.origin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
