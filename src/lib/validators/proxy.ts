import { z } from "zod/v4";

export const proxyRuleCreateSchema = z.object({
  proxyType: z.enum(["subd", "vdir"]).default("subd"),
  rootOrMatchingDomain: z.string().min(1),
  origin: z.string().min(1),
  requireTLS: z.boolean().default(false),
  skipCertValidation: z.boolean().default(false),
  useStickySession: z.boolean().default(false),
  useActiveLoadBalance: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

export const proxyRuleUpdateSchema = z.object({
  disabled: z.boolean().optional(),
  useStickySession: z.boolean().optional(),
  useActiveLoadBalance: z.boolean().optional(),
  bypassGlobalTLS: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  matchingDomainAlias: z.array(z.string().min(1)).optional(),
  activeOrigins: z.array(z.record(z.string(), z.unknown())).optional(),
  inactiveOrigins: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const upstreamAddSchema = z.object({
  origin: z.string().min(1),
  requireTLS: z.boolean().default(false),
  skipCertValidation: z.boolean().default(false),
  weight: z.number().int().min(1).max(100).default(1),
});

export const upstreamRemoveSchema = z.object({
  origin: z.string().min(1),
});

export const virtualDirectoryAddSchema = z.object({
  matchingPath: z.string().min(1),
  domain: z.string().min(1),
  requireTLS: z.boolean().default(false),
  skipCertValidation: z.boolean().default(false),
});

export const virtualDirectoryDeleteSchema = z.object({
  matchingPath: z.string().min(1),
});

export const headerRuleAddSchema = z.object({
  direction: z.enum(["upstream", "downstream"]),
  key: z.string().min(1),
  value: z.string().default(""),
  isRemove: z.boolean().default(false),
});

export const headerRuleDeleteSchema = z.object({
  direction: z.enum(["upstream", "downstream"]),
  key: z.string().min(1),
});

export const proxyAliasSetSchema = z.object({
  aliases: z.array(z.string().min(1)).default([]),
});

export type ProxyRuleCreateInput = z.infer<typeof proxyRuleCreateSchema>;
export type ProxyRuleUpdateInput = z.infer<typeof proxyRuleUpdateSchema>;
export type UpstreamAddInput = z.infer<typeof upstreamAddSchema>;
export type UpstreamRemoveInput = z.infer<typeof upstreamRemoveSchema>;
export type VirtualDirectoryAddInput = z.infer<typeof virtualDirectoryAddSchema>;
export type VirtualDirectoryDeleteInput = z.infer<typeof virtualDirectoryDeleteSchema>;
export type HeaderRuleAddInput = z.infer<typeof headerRuleAddSchema>;
export type HeaderRuleDeleteInput = z.infer<typeof headerRuleDeleteSchema>;
export type ProxyAliasSetInput = z.infer<typeof proxyAliasSetSchema>;
