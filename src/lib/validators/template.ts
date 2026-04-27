import { z } from "zod/v4";

export const templateCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum([
    "proxy_rule",
    "redirect",
    "access_rule",
    "cert",
    "stream",
    "full",
  ]),
  config: z.record(z.string(), z.unknown()),
  variables: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string(),
        defaultValue: z.string().optional(),
        required: z.boolean().default(true),
      })
    )
    .default([]),
  tags: z.array(z.string()).default([]),
});

export const templateUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  type: z
    .enum(["proxy_rule", "redirect", "access_rule", "cert", "stream", "full"])
    .optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  variables: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string(),
        defaultValue: z.string().optional(),
        required: z.boolean().default(true),
      })
    )
    .optional(),
  tags: z.array(z.string()).optional(),
});

export const templateDeploySchema = z.object({
  nodeIds: z.array(z.string().min(1)).min(1),
  variables: z.record(z.string(), z.string()).default({}),
});

export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;
export type TemplateDeployInput = z.infer<typeof templateDeploySchema>;
