import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const nodes = sqliteTable("nodes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull().default(8000),
  protocol: text("protocol", { enum: ["http", "https"] })
    .notNull()
    .default("https"),
  connectionMode: text("connection_mode", { enum: ["direct", "agent"] })
    .notNull()
    .default("direct"),
  authMethod: text("auth_method", {
    enum: ["session", "noauth", "agent_key"],
  })
    .notNull()
    .default("session"),
  credentials: text("credentials"), // encrypted JSON { username, password }
  agentToken: text("agent_token"),
  agentPort: integer("agent_port").default(9191),
  agentTls: integer("agent_tls", { mode: "boolean" }).default(false),
  tags: text("tags").default("[]"), // JSON array
  location: text("location"),
  status: text("status", {
    enum: ["online", "offline", "degraded", "unknown"],
  })
    .notNull()
    .default("unknown"),
  lastSeen: text("last_seen"),
  zoraxyVersion: text("zoraxy_version"),
  metadata: text("metadata"), // JSON
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const configTemplates = sqliteTable("config_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type", {
    enum: ["proxy_rule", "redirect", "access_rule", "cert", "stream", "full"],
  }).notNull(),
  config: text("config").notNull(), // JSON
  variables: text("variables").default("[]"), // JSON array of TemplateVariable
  tags: text("tags").default("[]"), // JSON array
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const templateDeployments = sqliteTable("template_deployments", {
  id: text("id").primaryKey(),
  templateId: text("template_id")
    .notNull()
    .references(() => configTemplates.id, { onDelete: "cascade" }),
  nodeId: text("node_id")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  variables: text("variables").default("{}"), // JSON
  status: text("status", {
    enum: ["pending", "deploying", "deployed", "failed", "outdated"],
  })
    .notNull()
    .default("pending"),
  deployedAt: text("deployed_at"),
  error: text("error"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  action: text("action").notNull(),
  entityType: text("entity_type", {
    enum: ["node", "proxy", "cert", "template", "system"],
  }).notNull(),
  entityId: text("entity_id"),
  nodeId: text("node_id"),
  details: text("details"), // JSON
  result: text("result", { enum: ["success", "failure"] })
    .notNull()
    .default("success"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const nodeSnapshots = sqliteTable("node_snapshots", {
  id: text("id").primaryKey(),
  nodeId: text("node_id")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  snapshotType: text("snapshot_type", {
    enum: ["proxy_rules", "certs", "full_config"],
  }).notNull(),
  data: text("data").notNull(), // JSON
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
