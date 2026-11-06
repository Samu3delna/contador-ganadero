// The shared root .env is also used for local backend development.
// A production frontend build must not inherit its NODE_ENV=development.
process.env.NODE_ENV = 'production';
const { build } = await import('vite');
await build();
await import('./prerender.mjs');
