import { z } from "zod";
import {
  CATEGORY_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  FAVICON_MAX_LENGTH,
  MARK_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  TOKEN_MAX_LENGTH,
  TOKEN_MIN_LENGTH,
  URL_MAX_LENGTH,
} from "./constants";
import { isValidFaviconValue } from "./favicon";

/** Accepts new strict marks and legacy migrated marks (looser length). */
const markSchema = z
  .string()
  .min(1)
  .max(MARK_MAX_LENGTH)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid mark format")
  .refine((m) => m === "demo" || !["api", "doc", "static"].includes(m.toLowerCase()), {
    message: "Reserved mark",
  });

const tokenSchema = z
  .string()
  .min(TOKEN_MIN_LENGTH)
  .max(TOKEN_MAX_LENGTH)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid token format");

const urlSchema = z
  .string()
  .max(URL_MAX_LENGTH)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), {
    message: "URL must start with http:// or https://",
  });

const faviconSchema = z
  .string()
  .max(FAVICON_MAX_LENGTH)
  .optional()
  .refine((v) => isValidFaviconValue(v), {
    message: "Invalid favicon",
  });

export const baseSchema = z.object({
  url: urlSchema,
  title: z.string().min(1).max(TITLE_MAX_LENGTH),
  description: z.string().max(DESCRIPTION_MAX_LENGTH).optional(),
  category: z.string().min(1).max(CATEGORY_MAX_LENGTH),
  favicon: faviconSchema,
});

export const insertSchema = z.object({
  ...baseSchema.shape,
  mark: markSchema,
  token: tokenSchema,
});

export const updateSchema = z.object({
  ...baseSchema.shape,
  mark: markSchema,
  uuid: z.string().min(1).max(64),
  token: tokenSchema,
});

export const deleteSchema = z.object({
  mark: markSchema,
  uuid: z.string().min(1).max(64),
  token: tokenSchema,
});

export const deleteManySchema = z.object({
  mark: markSchema,
  token: tokenSchema,
  uuids: z.array(z.string().min(1).max(64)).min(1).max(100),
});

export const categoryOrderSchema = z.object({
  mark: markSchema,
  token: tokenSchema,
  categories: z.array(z.string().min(1).max(CATEGORY_MAX_LENGTH)).max(50),
});

export const categoryMutationSchema = z.object({
  mark: markSchema,
  token: tokenSchema,
  category: z.string().min(1).max(CATEGORY_MAX_LENGTH),
  name: z.string().min(1).max(CATEGORY_MAX_LENGTH).optional(),
});

export const collectionSettingsSchema = z.object({
  redirectAfterSave: z.boolean(),
  defaultCategory: z.string().min(1).max(CATEGORY_MAX_LENGTH),
  homeCategory: z.string().max(CATEGORY_MAX_LENGTH),
  isPublic: z.boolean(),
  backgroundUrl: z.string().url().max(5 * 1024 * 1024).refine((value) => /^https?:\/\//i.test(value), "Background URL must start with http:// or https://").or(z.literal("")).default(""),
});

export const updateCollectionSettingsSchema = z.object({
  mark: markSchema,
  token: tokenSchema,
  redirectAfterSave: z.boolean().optional(),
  defaultCategory: z.string().min(1).max(CATEGORY_MAX_LENGTH).optional(),
  homeCategory: z.string().max(CATEGORY_MAX_LENGTH).optional(),
  isPublic: z.boolean().optional(),
  backgroundUrl: z.string().url().max(5 * 1024 * 1024).refine((value) => /^https?:\/\//i.test(value), "Background URL must start with http:// or https://").optional().or(z.literal("")),
});

export const reorderBookmarksSchema = z.object({
  mark: markSchema,
  token: tokenSchema,
  orders: z.array(z.object({
    category: z.string().min(1).max(CATEGORY_MAX_LENGTH),
    uuids: z.array(z.string().min(1).max(64)).min(1).max(500),
  })).min(1).max(50),
});

/** Claim / create a collection with a client-generated write token */
export const claimSchema = z.object({
  mark: markSchema,
  token: tokenSchema,
  settings: collectionSettingsSchema.optional(),
});

/** Regenerate write token for an existing collection (requires current token) */
export const regenerateTokenSchema = z.object({
  mark: markSchema,
  currentToken: tokenSchema,
  newToken: tokenSchema,
});

const importItemSchema = z.object({
  url: urlSchema,
  title: z.string().min(1).max(TITLE_MAX_LENGTH),
  description: z.string().max(DESCRIPTION_MAX_LENGTH).optional(),
  category: z.string().min(1).max(CATEGORY_MAX_LENGTH).default("default"),
  /** ISO date or unix seconds — optional, for preserving order */
  createdAt: z.string().optional(),
});

/** Bulk import (browser HTML / Cloudmark JSON) */
export const importBookmarksSchema = z.object({
  mark: markSchema,
  token: tokenSchema,
  bookmarks: z.array(importItemSchema).min(1).max(500),
  skipDuplicates: z.boolean().optional().default(true),
});

export type InsertSchema = z.infer<typeof insertSchema>;
export type UpdateSchema = z.infer<typeof updateSchema>;
export type DeleteSchema = z.infer<typeof deleteSchema>;
export type ClaimSchema = z.infer<typeof claimSchema>;
export type RegenerateTokenSchema = z.infer<typeof regenerateTokenSchema>;
export type ImportBookmarksSchema = z.infer<typeof importBookmarksSchema>;
export type ImportItemSchema = z.infer<typeof importItemSchema>;
export type CollectionSettingsSchema = z.infer<typeof collectionSettingsSchema>;
export type UpdateCollectionSettingsSchema = z.infer<
  typeof updateCollectionSettingsSchema
>;
export type ReorderBookmarksSchema = z.infer<typeof reorderBookmarksSchema>;
