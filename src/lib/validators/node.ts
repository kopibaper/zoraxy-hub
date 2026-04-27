import { z } from "zod/v4";

export const nodeCreateSchema = z.object({
  name: z.string().min(1).max(100),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).default(8000),
  protocol: z.enum(["http", "https"]).default("https"),
  connectionMode: z.enum(["direct", "agent"]).default("direct"),
  authMethod: z.enum(["session", "noauth", "agent_key"]).default("session"),
  username: z.string().optional(),
  password: z.string().optional(),
  agentToken: z.string().optional(),
  agentPort: z.number().int().min(1).max(65535).default(9191),
  agentTls: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  location: z.string().max(100).optional(),
});

export const nodeUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  host: z.string().min(1).max(255).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  protocol: z.enum(["http", "https"]).optional(),
  connectionMode: z.enum(["direct", "agent"]).optional(),
  authMethod: z.enum(["session", "noauth", "agent_key"]).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  agentToken: z.string().optional(),
  agentPort: z.number().int().min(1).max(65535).optional(),
  agentTls: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  location: z.string().max(100).optional(),
});

export type NodeCreateInput = z.infer<typeof nodeCreateSchema>;
export type NodeUpdateInput = z.infer<typeof nodeUpdateSchema>;
