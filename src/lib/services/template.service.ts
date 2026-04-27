import { db } from "../db";
import { configTemplates, nodes, templateDeployments } from "../db/schema";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";
import { logAudit } from "./audit.service";
import { NotFoundError, ValidationError } from "../errors";
import { getNode, getNodeConnector } from "./node.service";
import { substituteVariables, validateVariables } from "./template-engine";
import type {
  TemplateCreateInput,
  TemplateDeployInput,
  TemplateUpdateInput,
} from "../validators/template";
import type {
  ConfigTemplate,
  TemplateDeployment,
  TemplateType,
} from "@/types/template";
import type { INodeConnector } from "../connectors/interface";

function rowToTemplate(row: typeof configTemplates.$inferSelect): ConfigTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as ConfigTemplate["type"],
    config: JSON.parse(row.config),
    variables: row.variables ? JSON.parse(row.variables) : [],
    tags: row.tags ? JSON.parse(row.tags) : [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listTemplates(): Promise<ConfigTemplate[]> {
  const rows = await db.select().from(configTemplates);
  return rows.map(rowToTemplate);
}

export async function getTemplate(id: string): Promise<ConfigTemplate> {
  const rows = await db
    .select()
    .from(configTemplates)
    .where(eq(configTemplates.id, id))
    .limit(1);
  if (rows.length === 0) throw new NotFoundError("Template", id);
  return rowToTemplate(rows[0]);
}

export async function createTemplate(input: TemplateCreateInput): Promise<ConfigTemplate> {
  const id = ulid();
  const now = new Date().toISOString();

  await db.insert(configTemplates).values({
    id,
    name: input.name,
    description: input.description || null,
    type: input.type,
    config: JSON.stringify(input.config),
    variables: JSON.stringify(input.variables || []),
    tags: JSON.stringify(input.tags || []),
    createdAt: now,
    updatedAt: now,
  });

  await logAudit("template.create", "template", id, null, { name: input.name });
  return getTemplate(id);
}

export async function updateTemplate(
  id: string,
  input: TemplateUpdateInput
): Promise<ConfigTemplate> {
  await getTemplate(id);

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.type !== undefined) updates.type = input.type;
  if (input.config !== undefined) updates.config = JSON.stringify(input.config);
  if (input.variables !== undefined) updates.variables = JSON.stringify(input.variables);
  if (input.tags !== undefined) updates.tags = JSON.stringify(input.tags);

  await db.update(configTemplates).set(updates).where(eq(configTemplates.id, id));
  await logAudit("template.update", "template", id, null, {
    changes: Object.keys(updates).filter((k) => k !== "updatedAt"),
  });

  return getTemplate(id);
}

export async function deleteTemplate(id: string): Promise<void> {
  const template = await getTemplate(id);
  await db.delete(configTemplates).where(eq(configTemplates.id, id));
  await logAudit("template.delete", "template", id, null, { name: template.name });
}

export async function deployTemplate(
  templateId: string,
  input: TemplateDeployInput
): Promise<TemplateDeployment[]> {
  const template = await getTemplate(templateId);
  const variableCheck = validateVariables(template.config, input.variables);

  if (!variableCheck.valid) {
    throw new ValidationError(
      `Missing template variables: ${variableCheck.missing.join(", ")}`
    );
  }

  const substitutedConfig = substituteVariables(template.config, input.variables);
  const deployments: TemplateDeployment[] = [];

  for (const nodeId of input.nodeIds) {
    const deploymentId = ulid();
    const createdAt = new Date().toISOString();

    await db.insert(templateDeployments).values({
      id: deploymentId,
      templateId,
      nodeId,
      variables: JSON.stringify(input.variables),
      status: "pending",
      createdAt,
    });

    try {
      await db
        .update(templateDeployments)
        .set({ status: "deploying" })
        .where(eq(templateDeployments.id, deploymentId));

      const connector = await getConnectorForNode(nodeId);
      await deployByTemplateType(template.type, substitutedConfig, connector);

      const deployedAt = new Date().toISOString();

      await db
        .update(templateDeployments)
        .set({ status: "deployed", deployedAt, error: null })
        .where(eq(templateDeployments.id, deploymentId));

      deployments.push({
        id: deploymentId,
        templateId,
        nodeId,
        variables: input.variables,
        status: "deployed",
        deployedAt,
        error: null,
        createdAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Deployment failed";

      await db
        .update(templateDeployments)
        .set({ status: "failed", error: message })
        .where(eq(templateDeployments.id, deploymentId));

      deployments.push({
        id: deploymentId,
        templateId,
        nodeId,
        variables: input.variables,
        status: "failed",
        deployedAt: null,
        error: message,
        createdAt,
      });
    }
  }

  await logAudit(
    "template.deploy",
    "template",
    templateId,
    null,
    {
      templateName: template.name,
      nodeCount: input.nodeIds.length,
      results: deployments.map((item) => ({
        nodeId: item.nodeId,
        status: item.status,
        error: item.error,
      })),
    },
    deployments.every((item) => item.status === "deployed") ? "success" : "failure"
  );

  return deployments;
}

export async function getDeployments(templateId: string): Promise<TemplateDeployment[]> {
  const rows = await db
    .select()
    .from(templateDeployments)
    .where(eq(templateDeployments.templateId, templateId));

  return rows.map((r) => ({
    id: r.id,
    templateId: r.templateId,
    nodeId: r.nodeId,
    variables: r.variables ? JSON.parse(r.variables) : {},
    status: r.status as TemplateDeployment["status"],
    deployedAt: r.deployedAt,
    error: r.error,
    createdAt: r.createdAt,
  }));
}

async function getConnectorForNode(nodeId: string): Promise<INodeConnector> {
  const node = await getNode(nodeId);
  const row = await db
    .select({ credentials: nodes.credentials })
    .from(nodes)
    .where(eq(nodes.id, nodeId))
    .limit(1);

  if (row.length === 0) {
    throw new NotFoundError("Node", nodeId);
  }

  return getNodeConnector(node, row[0].credentials);
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${key} is required`);
  }
  return value;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return fallback;
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asStringArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${key} must be an array of strings`);
  }

  const output = value.filter((item): item is string => typeof item === "string");
  if (output.length === 0) {
    throw new ValidationError(`${key} must be an array of strings`);
  }

  return output;
}

async function deployByTemplateType(
  templateType: TemplateType,
  config: Record<string, unknown>,
  connector: INodeConnector
) {
  if (templateType === "proxy_rule") {
    const proxyType = requireString(config, "proxyType");
    const rootDomain =
      (typeof config.rootDomain === "string" && config.rootDomain) ||
      (typeof config.rootOrMatchingDomain === "string" ? config.rootOrMatchingDomain : "");
    if (!rootDomain) {
      throw new ValidationError("rootDomain or rootOrMatchingDomain is required");
    }
    const origin = requireString(config, "origin");
    await connector.addProxyRule(proxyType, rootDomain, origin, asBoolean(config.requireTLS, false));
    return;
  }

  if (templateType === "redirect") {
    await connector.addRedirect(
      requireString(config, "redirectUrl"),
      requireString(config, "destUrl"),
      asNumber(config.statusCode, 302)
    );
    return;
  }

  if (templateType === "stream") {
    await connector.addStreamProxy(config);
    return;
  }

  if (templateType === "cert") {
    const domains = asStringArray(config.domains, "domains");
    const email = requireString(config, "email");
    await connector.obtainACME(domains, email);
    return;
  }

  if (templateType === "access_rule") {
    const ruleId = requireString(config, "ruleId");
    const ip = requireString(config, "ip");
    const mode =
      (typeof config.mode === "string" ? config.mode : undefined) ||
      (typeof config.type === "string" ? config.type : undefined) ||
      "blacklist";

    if (mode === "whitelist") {
      await connector.addWhitelist(ruleId, ip);
      return;
    }

    await connector.addBlacklist(ruleId, ip);
    return;
  }

  const sections = Object.entries(config);
  for (const [sectionKey, sectionValue] of sections) {
    const nestedType = mapFullSectionToType(sectionKey, sectionValue);
    if (!nestedType) continue;

    if (Array.isArray(sectionValue)) {
      for (const item of sectionValue) {
        await deployByTemplateType(nestedType, requireRecord(item, sectionKey), connector);
      }
    } else {
      await deployByTemplateType(nestedType, requireRecord(sectionValue, sectionKey), connector);
    }
  }
}

function mapFullSectionToType(
  sectionKey: string,
  sectionValue: unknown
): Exclude<TemplateType, "full"> | null {
  const normalized = sectionKey.toLowerCase();

  if (normalized === "proxy_rule" || normalized === "proxy_rules" || normalized === "proxies") {
    return "proxy_rule";
  }
  if (normalized === "redirect" || normalized === "redirects") {
    return "redirect";
  }
  if (normalized === "stream" || normalized === "streams" || normalized === "stream_proxies") {
    return "stream";
  }
  if (normalized === "cert" || normalized === "certs" || normalized === "acme") {
    return "cert";
  }
  if (normalized === "access_rule" || normalized === "access_rules" || normalized === "access") {
    return "access_rule";
  }

  if (
    sectionValue &&
    typeof sectionValue === "object" &&
    !Array.isArray(sectionValue) &&
    typeof (sectionValue as { type?: unknown }).type === "string"
  ) {
    const explicitType = (sectionValue as { type: string }).type;
    if (
      explicitType === "proxy_rule" ||
      explicitType === "redirect" ||
      explicitType === "stream" ||
      explicitType === "cert" ||
      explicitType === "access_rule"
    ) {
      return explicitType;
    }
  }

  return null;
}
