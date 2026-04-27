import { z } from "zod/v4";

export const nodeConfigSchema = z.object({
  proxyRules: z.array(z.record(z.string(), z.unknown())),
  certs: z.array(z.record(z.string(), z.unknown())),
  accessRules: z.array(z.unknown()),
  streamProxies: z.array(z.unknown()),
  redirects: z.array(z.unknown()),
  systemInfo: z.record(z.string(), z.unknown()),
  exportedAt: z.string(),
  nodeId: z.string().min(1),
  nodeName: z.string().min(1),
});

export const importNodeConfigSchema = z.object({
  config: nodeConfigSchema,
  overwrite: z.boolean().default(false),
  skipExisting: z.boolean().default(true),
});

export const compareNodesSchema = z.object({
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
});

export const cloneNodeConfigSchema = z.object({
  sourceNodeId: z.string().min(1),
  proxyRules: z.boolean().default(true),
  certs: z.boolean().default(true),
  streams: z.boolean().default(true),
  redirects: z.boolean().default(true),
});
