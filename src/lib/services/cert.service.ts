import { db } from "../db";
import { nodes } from "../db/schema";
import { eq } from "drizzle-orm";
import { getNodeConnector, getNode } from "./node.service";
import { logAudit } from "./audit.service";
import { NotFoundError } from "../errors";
import type { ZoraxyCertInfo } from "../zoraxy/types";

async function getConnectorForNode(nodeId: string) {
  const node = await getNode(nodeId);
  const row = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);
  if (row.length === 0) throw new NotFoundError("Node", nodeId);
  return { connector: getNodeConnector(node, row[0].credentials), node };
}

export async function listCerts(nodeId: string): Promise<ZoraxyCertInfo[]> {
  const { connector } = await getConnectorForNode(nodeId);
  return connector.listCerts();
}

export async function uploadCert(
  nodeId: string,
  domain: string,
  certPem: string,
  keyPem: string
): Promise<void> {
  const { connector, node } = await getConnectorForNode(nodeId);
  await connector.uploadCert(domain, certPem, keyPem);
  await logAudit("cert.upload", "cert", domain, nodeId, {
    nodeName: node.name,
    domain,
  });
}

export async function deleteCert(nodeId: string, domain: string): Promise<void> {
  const { connector, node } = await getConnectorForNode(nodeId);
  await connector.deleteCert(domain);
  await logAudit("cert.delete", "cert", domain, nodeId, {
    nodeName: node.name,
    domain,
  });
}

export async function obtainACME(
  nodeId: string,
  domains: string[],
  email: string
): Promise<void> {
  const { connector, node } = await getConnectorForNode(nodeId);
  await connector.obtainACME(domains, email);
  await logAudit("cert.acme", "cert", domains.join(","), nodeId, {
    nodeName: node.name,
    domains,
    email,
  });
}

export async function getAutoRenewDomains(nodeId: string): Promise<string[]> {
  const { connector } = await getConnectorForNode(nodeId);
  return connector.getAutoRenewDomains();
}
