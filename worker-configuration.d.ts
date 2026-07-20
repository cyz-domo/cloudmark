interface CloudflareEnv {
  DB: D1Database;
  ASSETS: Fetcher;
  BASE_URL?: string;
}

declare namespace Cloudflare {
  interface Env extends CloudflareEnv {}
}
