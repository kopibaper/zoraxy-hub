import { db } from "../db";
import { nodes } from "../db/schema";
import { eq } from "drizzle-orm";
import { getNodeConnector, getNode } from "./node.service";
import { logAudit } from "./audit.service";
import { NotFoundError } from "../errors";
import type { ZoraxyProxyEntry, ZoraxyOrigin } from "../zoraxy/types";

async function getConnectorForNode(nodeId: string) {
  const node = await getNode(nodeId);
  const row = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);
  if (row.length === 0) throw new NotFoundError("Node", nodeId);
  return { connector: getNodeConnector(node, row[0].credentials), node };
}

export async function listProxyRules(nodeId: string): Promise<ZoraxyProxyEntry[]> {
  const { connector } = await getConnectorForNode(nodeId);
  return connector.listProxyRules();
}

export async function getProxyDetail(nodeId: string, domain: string): Promise<ZoraxyProxyEntry> {
  const { connector } = await getConnectorForNode(nodeId);
  return connector.getProxyDetail(domain);
}

export async function addProxyRule(
  nodeId: string,
  proxyType: string,
  rootDomain: string,
  origin: string,
  requireTLS: boolean
): Promise<void> {
  const { connector, node } = await getConnectorForNode(nodeId);
  await connector.addProxyRule(proxyType, rootDomain, origin, requireTLS);
  await logAudit("proxy.add", "proxy", rootDomain, nodeId, {
    nodeName: node.name,
    proxyType,
    rootDomain,
    origin,
  });
}

export async function deleteProxyRule(nodeId: string, domain: string): Promise<void> {
  const { connector, node } = await getConnectorForNode(nodeId);
  await connector.deleteProxyRule(domain);
  await logAudit("proxy.delete", "proxy", domain, nodeId, {
    nodeName: node.name,
    domain,
  });
}

export async function toggleProxyRule(
  nodeId: string,
  domain: string,
  enabled: boolean
): Promise<void> {
  const { connector, node } = await getConnectorForNode(nodeId);
  await connector.toggleProxyRule(domain, enabled);
  await logAudit("proxy.toggle", "proxy", domain, nodeId, {
    nodeName: node.name,
    domain,
    enabled,
  });
}

export async function editProxyRule(
  nodeId: string,
  domain: string,
  updates: Record<string, unknown>
): Promise<void> {
  const { connector, node } = await getConnectorForNode(nodeId);

  const rawAliases = updates.matchingDomainAlias;
  const aliases = Array.isArray(rawAliases)
    ? rawAliases.filter((alias): alias is string => typeof alias === "string")
    : null;

  if (aliases) {
    await connector.setDomainAliases(domain, aliases);
  }

  const editUpdates = { ...updates };
  delete editUpdates.matchingDomainAlias;

  if (Object.keys(editUpdates).length > 0) {
    await connector.editProxyRule(domain, editUpdates);
  }

  await logAudit("proxy.edit", "proxy", domain, nodeId, {
    nodeName: node.name,
    domain,
    changes: Object.keys(updates),
  });
}

export async function listUpstreams(nodeId: string, domain: string): Promise<ZoraxyOrigin[]> {
  const { connector } = await getConnectorForNode(nodeId);
  return connector.listUpstreams(domain);
}

export async function addUpstream(
  nodeId: string,
  domain: string,
  origin: string,
  requireTLS: boolean,
  skipCertValidation = false,
  weight = 1
): Promise<void> {
  const { connector, node } = await getConnectorForNode(nodeId);
  await connector.addUpstream(domain, origin, requireTLS, skipCertValidation, weight);
  await logAudit("upstream.add", "proxy", domain, nodeId, {
    nodeName: node.name,
    domain,
    origin,
  });
}

export async function removeUpstream(
  nodeId: string,
  domain: string,
  origin: string
): Promise<void> {
  const { connector, node } = await getConnectorForNode(nodeId);
  await connector.removeUpstream(domain, origin);
  await logAudit("upstream.remove", "proxy", domain, nodeId, {
    nodeName: node.name,
    domain,
    origin,
  });
}

export async function addVirtualDirectory(
  nodeId: string,
  rootDomain: string,
  matchingPath: string,
  domain: string,
  requireTLS: boolean,
  skipCertValidation: boolean
): Promise<void> {
  const { connector, node } = await getConnectorForNode(nodeId);
  await connector.addVirtualDirectory(
    rootDomain,
    matchingPath,
    domain,
    requireTLS,
    skipCertValidation
  );
  await logAudit("vdir.add", "proxy", rootDomain, nodeId, {
    nodeName: node.name,
    rootDomain,
    matchingPath,
    domain,
  });
}

export async function deleteVirtualDirectory(
  nodeId: string,
  rootDomain: string,
  matchingPath: string
): Promise<void> {
  const { connector, node } = await getConnectorForNode(nodeId);
  await connector.deleteVirtualDirectory(rootDomain, matchingPath);
  await logAudit("vdir.delete", "proxy", rootDomain, nodeId, {
    nodeName: node.name,
    rootDomain,
    matchingPath,
  });
}

export async function addHeaderRewriteRule(
  nodeId: string,
  rootDomain: string,
  direction: string,
  key: string,
  value: string,
  isRemove: boolean
): Promise<void> {
  const { connector, node } = await getConnectorForNode(nodeId);
  await connector.addHeaderRewriteRule(rootDomain, direction, key, value, isRemove);
  await logAudit("header.add", "proxy", rootDomain, nodeId, {
    nodeName: node.name,
    rootDomain,
    direction,
    key,
    isRemove,
  });
}

export async function deleteHeaderRewriteRule(
  nodeId: string,
  rootDomain: string,
  direction: string,
  key: string
): Promise<void> {
  const { connector, node } = await getConnectorForNode(nodeId);
  await connector.deleteHeaderRewriteRule(rootDomain, direction, key);
  await logAudit("header.delete", "proxy", rootDomain, nodeId, {
    nodeName: node.name,
    rootDomain,
    direction,
    key,
  });
}
