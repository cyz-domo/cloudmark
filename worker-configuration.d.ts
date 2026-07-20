interface CloudflareEnv {
  DB: D1Database;
  /** Legacy KV namespace for one-time migration */
  cloudmark?: KVNamespace;
  ASSETS: Fetcher;
  BASE_URL?: string;
}

declare namespace Cloudflare {
  interface Env extends CloudflareEnv {}
}
