import { Hono } from "hono";
import {
  claimSchema,
  deleteSchema,
  importBookmarksSchema,
  insertSchema,
  regenerateTokenSchema,
  updateCollectionSettingsSchema,
  reorderBookmarksSchema,
  updateSchema,
} from "@/shared/schema";
import {
  claimCollection,
  createBookmark,
  deleteBookmarkRecord,
  getCollectionPageData,
  importBookmarks,
  regenerateToken,
  saveCollectionSettings,
  updateBookmarkRecord,
  reorderCollectionBookmarks,
} from "../services/bookmarks";
import type { Env } from "../env";

const api = new Hono<{ Bindings: Env }>();

function jsonError(c: { json: (data: unknown, status?: number) => Response }, message: string, status = 400) {
  return c.json({ error: message }, status);
}

/** GET /api/collections/:mark — optional X-Cloudmark-Token for private collections */
api.get("/collections/:mark", async (c) => {
  const mark = c.req.param("mark");
  const viewToken =
    c.req.header("X-Cloudmark-Token") ||
    c.req.query("token") ||
    null;
  try {
    const data = await getCollectionPageData(c.env.DB, mark, viewToken);
    return c.json(data);
  } catch (e) {
    console.error(e);
    return jsonError(c, e instanceof Error ? e.message : "Failed to load collection", 500);
  }
});

api.post("/collections/reorder", async (c) => {
  try {
    const parsed = reorderBookmarksSchema.safeParse(await c.req.json());
    if (!parsed.success) return jsonError(c, parsed.error.errors[0]?.message ?? "Invalid input");
    await reorderCollectionBookmarks(c.env.DB, parsed.data.mark, parsed.data.token, parsed.data.orders);
    return c.json({ ok: true });
  } catch (e) {
    return jsonError(c, e instanceof Error ? e.message : "Reorder failed", 400);
  }
});

/** POST /api/collections/claim */
api.post("/collections/claim", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, parsed.error.errors[0]?.message ?? "Invalid input");
    }
    const result = await claimCollection(
      c.env.DB,
      parsed.data.mark,
      parsed.data.token,
      parsed.data.settings,
    );
    return c.json(result);
  } catch (e) {
    return jsonError(c, e instanceof Error ? e.message : "Claim failed", 400);
  }
});

/** PUT /api/collections/settings */
api.put("/collections/settings", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = updateCollectionSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, parsed.error.errors[0]?.message ?? "Invalid input");
    }
    const { mark, token, ...patch } = parsed.data;
    const settings = await saveCollectionSettings(c.env.DB, mark, token, patch);
    return c.json({ settings });
  } catch (e) {
    return jsonError(
      c,
      e instanceof Error ? e.message : "Failed to save settings",
      400,
    );
  }
});

/** POST /api/collections/regenerate-token */
api.post("/collections/regenerate-token", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = regenerateTokenSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, parsed.error.errors[0]?.message ?? "Invalid input");
    }
    const result = await regenerateToken(
      c.env.DB,
      parsed.data.mark,
      parsed.data.currentToken,
      parsed.data.newToken,
    );
    return c.json(result);
  } catch (e) {
    return jsonError(c, e instanceof Error ? e.message : "Regenerate failed", 400);
  }
});

/** POST /api/bookmarks */
api.post("/bookmarks", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = insertSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, parsed.error.errors[0]?.message ?? "Invalid input");
    }
    const bookmark = await createBookmark(c.env.DB, parsed.data);
    return c.json(bookmark, 201);
  } catch (e) {
    return jsonError(c, e instanceof Error ? e.message : "Create failed", 400);
  }
});

/** PUT /api/bookmarks/:uuid */
api.put("/bookmarks/:uuid", async (c) => {
  try {
    const uuid = c.req.param("uuid");
    const body = await c.req.json();
    const parsed = updateSchema.safeParse({ ...body, uuid });
    if (!parsed.success) {
      return jsonError(c, parsed.error.errors[0]?.message ?? "Invalid input");
    }
    const bookmark = await updateBookmarkRecord(c.env.DB, parsed.data);
    return c.json(bookmark);
  } catch (e) {
    return jsonError(c, e instanceof Error ? e.message : "Update failed", 400);
  }
});

/** DELETE /api/bookmarks/:uuid */
api.delete("/bookmarks/:uuid", async (c) => {
  try {
    const uuid = c.req.param("uuid");
    const body = await c.req.json();
    const parsed = deleteSchema.safeParse({ ...body, uuid });
    if (!parsed.success) {
      return jsonError(c, parsed.error.errors[0]?.message ?? "Invalid input");
    }
    await deleteBookmarkRecord(c.env.DB, parsed.data);
    return c.json({ ok: true });
  } catch (e) {
    return jsonError(c, e instanceof Error ? e.message : "Delete failed", 400);
  }
});

/** POST /api/bookmarks/import — bulk import (HTML/JSON parsed client-side) */
api.post("/bookmarks/import", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = importBookmarksSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, parsed.error.errors[0]?.message ?? "Invalid input");
    }
    const result = await importBookmarks(c.env.DB, parsed.data);
    return c.json(result);
  } catch (e) {
    return jsonError(c, e instanceof Error ? e.message : "Import failed", 400);
  }
});

export { api };
