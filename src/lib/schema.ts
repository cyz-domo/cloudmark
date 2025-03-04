import { z } from "zod";

export const baseSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
});

export const insertSchema = z.object({
  ...baseSchema.shape,
  mark: z.string().min(1),
});

export const updateSchema = z.object({
  ...baseSchema.shape,
  mark: z.string().min(1),
  uuid: z.string().min(1),
});

export const deleteSchema = z.object({
  mark: z.string().min(1),
  uuid: z.string().min(1),
});

export type InsertSchema = z.infer<typeof insertSchema>;
export type UpdateSchema = z.infer<typeof updateSchema>;
export type DeleteSchema = z.infer<typeof deleteSchema>;
