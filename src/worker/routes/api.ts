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
  deleteManySchema,
  categoryOrderSchema,
  categoryMutationSchema,
  sortProfileSchema,
  sortProfileRenameSchema,
  sortProfileIdSchema,
  sortProfileOrdersSchema,
  categorySortsSchema,
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
  reorderCollectionCategories,
  renameCollectionCategory,
  deleteCollectionCategory,
  deleteBookmarkRecords,
  listCollectionSortProfiles,
  createCollectionSortProfile,
  renameCollectionSortProfile,
  deleteCollectionSortProfile,
  saveCollectionSortProfileOrders,
  listCategorySorts,
  saveCategorySortsService,
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

api.post("/collections/categories/reorder", async (c) => {
  try { const parsed = categoryOrderSchema.safeParse(await c.req.json()); if (!parsed.success) return jsonError(c, parsed.error.errors[0]?.message ?? "Invalid input"); await reorderCollectionCategories(c.env.DB, parsed.data.mark, parsed.data.token, parsed.data.categories); return c.json({ ok: true }); } catch (e) { return jsonError(c, e instanceof Error ? e.message : "Category reorder failed", 400); }
});

api.post("/collections/categories/rename", async (c) => {
  try { const parsed = categoryMutationSchema.safeParse(await c.req.json()); if (!parsed.success || !parsed.data.name) return jsonError(c, "Invalid input"); await renameCollectionCategory(c.env.DB, parsed.data.mark, parsed.data.token, parsed.data.category, parsed.data.name); return c.json({ ok: true }); } catch (e) { return jsonError(c, e instanceof Error ? e.message : "Category rename failed", 400); }
});

api.delete("/collections/categories", async (c) => {
  try { const parsed = categoryMutationSchema.safeParse(await c.req.json()); if (!parsed.success) return jsonError(c, "Invalid input"); const deleted = await deleteCollectionCategory(c.env.DB, parsed.data.mark, parsed.data.token, parsed.data.category); return c.json({ ok: true, deleted }); } catch (e) { return jsonError(c, e instanceof Error ? e.message : "Category delete failed", 400); }
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

api.get("/collections/:mark/sort-profiles", async (c) => {
  try {
    const token = c.req.header("X-Cloudmark-Token") || "";
    return c.json({ profiles: await listCollectionSortProfiles(c.env.DB, c.req.param("mark"), token) });
  } catch (e) { return jsonError(c, e instanceof Error ? e.message : "Failed to load sort profiles", 400); }
});

api.post("/collections/sort-profiles", async (c) => {
  try { const parsed = sortProfileSchema.safeParse(await c.req.json()); if (!parsed.success) return jsonError(c, "Invalid input"); const profile = await createCollectionSortProfile(c.env.DB, parsed.data.mark, parsed.data.token, parsed.data.id, parsed.data.category, parsed.data.name); return c.json({ profile }); } catch (e) { return jsonError(c, e instanceof Error ? e.message : "Failed to create sort profile", 400); }
});

api.put("/collections/sort-profiles/:id", async (c) => {
  try { const parsed = sortProfileRenameSchema.safeParse({ ...(await c.req.json()), id: c.req.param("id") }); if (!parsed.success) return jsonError(c, "Invalid input"); await renameCollectionSortProfile(c.env.DB, parsed.data.mark, parsed.data.token, parsed.data.id, parsed.data.name); return c.json({ ok: true }); } catch (e) { return jsonError(c, e instanceof Error ? e.message : "Failed to rename sort profile", 400); }
});

api.delete("/collections/sort-profiles/:id", async (c) => {
  try { const parsed = sortProfileIdSchema.safeParse({ ...(await c.req.json()), id: c.req.param("id") }); if (!parsed.success) return jsonError(c, "Invalid input"); await deleteCollectionSortProfile(c.env.DB, parsed.data.mark, parsed.data.token, parsed.data.id); return c.json({ ok: true }); } catch (e) { return jsonError(c, e instanceof Error ? e.message : "Failed to delete sort profile", 400); }
});

api.post("/collections/sort-profiles/orders", async (c) => {
  try { const parsed = sortProfileOrdersSchema.safeParse(await c.req.json()); if (!parsed.success) return jsonError(c, "Invalid input"); await saveCollectionSortProfileOrders(c.env.DB, parsed.data.mark, parsed.data.token, parsed.data.id, parsed.data.orders); return c.json({ ok: true }); } catch (e) { return jsonError(c, e instanceof Error ? e.message : "Failed to save sort profile", 400); }
});

api.get("/collections/:mark/category-sorts", async (c) => {
  try {
    const token = c.req.header("X-Cloudmark-Token") || "";
    return c.json({ sorts: await listCategorySorts(c.env.DB, c.req.param("mark"), token) });
  } catch (e) { return jsonError(c, e instanceof Error ? e.message : "Failed to load category sorts", 400); }
});

api.put("/collections/category-sorts", async (c) => {
  try { const parsed = categorySortsSchema.safeParse(await c.req.json()); if (!parsed.success) return jsonError(c, "Invalid input"); await saveCategorySortsService(c.env.DB, parsed.data.mark, parsed.data.token, parsed.data.sorts); return c.json({ ok: true }); } catch (e) { return jsonError(c, e instanceof Error ? e.message : "Failed to save category sorts", 400); }
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

api.post("/bookmarks/delete-many", async (c) => {
  try { const parsed = deleteManySchema.safeParse(await c.req.json()); if (!parsed.success) return jsonError(c, parsed.error.errors[0]?.message ?? "Invalid input"); const deleted = await deleteBookmarkRecords(c.env.DB, parsed.data); return c.json({ ok: true, deleted }); } catch (e) { return jsonError(c, e instanceof Error ? e.message : "Delete failed", 400); }
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
