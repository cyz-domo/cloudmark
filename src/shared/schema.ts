import { z } from "zod";
import {
  CATEGORY_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  MARK_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  TOKEN_MAX_LENGTH,
  TOKEN_MIN_LENGTH,
  URL_MAX_LENGTH,
} from "./constants";

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

export const baseSchema = z.object({
  url: urlSchema,
  title: z.string().min(1).max(TITLE_MAX_LENGTH),
  description: z.string().max(DESCRIPTION_MAX_LENGTH).optional(),
  category: z.string().min(1).max(CATEGORY_MAX_LENGTH),
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

/** Claim / create a collection with a client-generated write token */
export const claimSchema = z.object({
  mark: markSchema,
  token: tokenSchema,
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
