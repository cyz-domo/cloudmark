import { Hono } from "hono";
import { cors } from "hono/cors";
import { api } from "./routes/api";
import { bookmarklet } from "./routes/bookmarklet";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "SAMEORIGIN");
  c.res.headers.set("Content-Security-Policy", "frame-ancestors 'self'");
  // Bookmarklet URLs carry the write token in the query string; never leak it via Referer.
  c.res.headers.set(
    "Referrer-Policy",
    c.req.path === "/api/add" ? "no-referrer" : "strict-origin-when-cross-origin",
  );
});

app.use("/api/*", cors());

app.get("/api/health", (c) => c.json({ ok: true, service: "cloudmark" }));

app.route("/api", api);
app.route("/api", bookmarklet);

// SPA assets are served by the Cloudflare assets binding (not_found_handling: SPA).
// Non-API requests fall through to the asset handler when this worker is configured
// with assets + SPA fallback.
app.notFound(async (c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: "Not found" }, 404);
  }
  // Let the ASSETS binding handle SPA routing when available
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text("Not found", 404);
});

export default app;
