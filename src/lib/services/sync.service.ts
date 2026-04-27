import { db } from "../db";
import { nodes } from "../db/schema";
import { eq } from "drizzle-orm";
import { NotFoundError } from "../errors";
import { getNode, getNodeConnector } from "./node.service";
import { logAudit } from "./audit.service";
import type { NodeSystemInfo } from "../connectors/interface";
import type { ZoraxyCertInfo, ZoraxyProxyEntry } from "../zoraxy/types";

export interface NodeConfig {
  proxyRules: ZoraxyProxyEntry[];
  certs: ZoraxyCertInfo[];
  accessRules: unknown[];
  streamProxies: unknown[];
  redirects: unknown[];
  systemInfo: NodeSystemInfo;
  exportedAt: string;
  nodeId: string;
  nodeName: string;
}

export interface ConfigDiff {
  proxyRules: {
    added: ZoraxyProxyEntry[];
    removed: ZoraxyProxyEntry[];
    modified: Array<{
      domain: string;
      source: ZoraxyProxyEntry;
      target: ZoraxyProxyEntry;
    }>;
    unchanged: string[];
  };
  certs: {
    added: ZoraxyCertInfo[];
    removed: ZoraxyCertInfo[];
    unchanged: string[];
  };
  streamProxies: { added: unknown[]; removed: unknown[] };
  redirects: { added: unknown[]; removed: unknown[] };
}

type ImportOptions = {
  overwrite: boolean;
  skipExisting: boolean;
};

type CloneOptions = {
  proxyRules: boolean;
  certs: boolean;
  streams: boolean;
  redirects: boolean;
};

type ImportResult = {
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
};

type CloneResult = {
  success: number;
  failed: number;
  errors: string[];
};

interface StreamLike {
  ID?: string;
  Name?: string;
  Protocol?: "tcp" | "udp" | string;
  ListeningAddr?: string;
  ListeningPort?: number;
  ProxyAddr?: string;
  ProxyPort?: number;
  Running?: boolean;
}

interface RedirectLike {
  ID?: string;
  RedirectURL?: string;
  DestURL?: string;
  StatusCode?: number;
  ForwardChildpath?: boolean;
}

async function getConnectorForNode(nodeId: string) {
  const node = await getNode(nodeId);
  const row = await db.select().from(nodes).where(eq(nodes.id, nodeId)).limit(1);
  if (row.length === 0) throw new NotFoundError("Node", nodeId);
  return { node, connector: getNodeConnector(node, row[0].credentials) };
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sortedKeys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
    const sorted: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      sorted[key] = sortObject(obj[key]);
    }
    return sorted;
  }

  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortObject(value));
}

function streamKey(input: unknown): string {
  const stream = (input ?? {}) as StreamLike;
  return [
    stream.Name ?? "",
    stream.Protocol ?? "",
    stream.ListeningAddr ?? "",
    stream.ListeningPort ?? "",
  ].join("|");
}

function redirectKey(input: unknown): string {
  const redirect = (input ?? {}) as RedirectLike;
  return redirect.RedirectURL ?? "";
}

function toStreamConfig(input: unknown): Record<string, unknown> | null {
  const stream = (input ?? {}) as StreamLike;
  if (
    typeof stream.Name !== "string" ||
    typeof stream.Protocol !== "string" ||
    typeof stream.ListeningAddr !== "string" ||
    typeof stream.ListeningPort !== "number" ||
    typeof stream.ProxyAddr !== "string" ||
    typeof stream.ProxyPort !== "number"
  ) {
    return null;
  }

  return {
    Name: stream.Name,
    Protocol: stream.Protocol,
    ListeningAddr: stream.ListeningAddr,
    ListeningPort: stream.ListeningPort,
    ProxyAddr: stream.ProxyAddr,
    ProxyPort: stream.ProxyPort,
  };
}

export async function exportNodeConfig(nodeId: string): Promise<NodeConfig> {
  const { node, connector } = await getConnectorForNode(nodeId);

  const [
    proxyRules,
    certs,
    accessRules,
    streamProxies,
    redirects,
    systemInfo,
  ] = await Promise.all([
    connector.listProxyRules(),
    connector.listCerts(),
    connector.listAccessRules(),
    connector.listStreamProxies(),
    connector.listRedirects(),
    connector.getSystemInfo(),
  ]);

  const exported = {
    proxyRules,
    certs,
    accessRules,
    streamProxies,
    redirects,
    systemInfo,
    exportedAt: new Date().toISOString(),
    nodeId: node.id,
    nodeName: node.name,
  };

  await logAudit("sync.export", "node", node.id, node.id, {
    nodeName: node.name,
    proxyRules: proxyRules.length,
    certs: certs.length,
    streams: streamProxies.length,
    redirects: redirects.length,
  });

  return exported;
}

export async function compareNodes(
  sourceNodeId: string,
  targetNodeId: string
): Promise<ConfigDiff> {
  const [source, target] = await Promise.all([
    exportNodeConfig(sourceNodeId),
    exportNodeConfig(targetNodeId),
  ]);

  const sourceProxyMap = new Map(
    source.proxyRules.map((rule) => [rule.RootOrMatchingDomain, rule])
  );
  const targetProxyMap = new Map(
    target.proxyRules.map((rule) => [rule.RootOrMatchingDomain, rule])
  );

  const addedProxyRules: ZoraxyProxyEntry[] = [];
  const removedProxyRules: ZoraxyProxyEntry[] = [];
  const modifiedProxyRules: Array<{
    domain: string;
    source: ZoraxyProxyEntry;
    target: ZoraxyProxyEntry;
  }> = [];
  const unchangedProxyRules: string[] = [];

  for (const [domain, targetRule] of targetProxyMap) {
    const sourceRule = sourceProxyMap.get(domain);
    if (!sourceRule) {
      addedProxyRules.push(targetRule);
      continue;
    }

    if (stableStringify(sourceRule) !== stableStringify(targetRule)) {
      modifiedProxyRules.push({ domain, source: sourceRule, target: targetRule });
    } else {
      unchangedProxyRules.push(domain);
    }
  }

  for (const [domain, sourceRule] of sourceProxyMap) {
    if (!targetProxyMap.has(domain)) {
      removedProxyRules.push(sourceRule);
    }
  }

  const sourceCertMap = new Map(source.certs.map((cert) => [cert.Domain, cert]));
  const targetCertMap = new Map(target.certs.map((cert) => [cert.Domain, cert]));

  const addedCerts: ZoraxyCertInfo[] = [];
  const removedCerts: ZoraxyCertInfo[] = [];
  const unchangedCerts: string[] = [];

  for (const [domain, targetCert] of targetCertMap) {
    if (!sourceCertMap.has(domain)) {
      addedCerts.push(targetCert);
    } else {
      unchangedCerts.push(domain);
    }
  }

  for (const [domain, sourceCert] of sourceCertMap) {
    if (!targetCertMap.has(domain)) {
      removedCerts.push(sourceCert);
    }
  }

  const sourceStreamMap = new Map(
    source.streamProxies.map((item) => [streamKey(item), item])
  );
  const targetStreamMap = new Map(
    target.streamProxies.map((item) => [streamKey(item), item])
  );

  const addedStreams: unknown[] = [];
  const removedStreams: unknown[] = [];

  for (const [key, targetStream] of targetStreamMap) {
    if (!sourceStreamMap.has(key)) addedStreams.push(targetStream);
  }
  for (const [key, sourceStream] of sourceStreamMap) {
    if (!targetStreamMap.has(key)) removedStreams.push(sourceStream);
  }

  const sourceRedirectMap = new Map(
    source.redirects.map((item) => [redirectKey(item), item])
  );
  const targetRedirectMap = new Map(
    target.redirects.map((item) => [redirectKey(item), item])
  );

  const addedRedirects: unknown[] = [];
  const removedRedirects: unknown[] = [];

  for (const [key, targetRedirect] of targetRedirectMap) {
    if (!sourceRedirectMap.has(key)) addedRedirects.push(targetRedirect);
  }
  for (const [key, sourceRedirect] of sourceRedirectMap) {
    if (!targetRedirectMap.has(key)) removedRedirects.push(sourceRedirect);
  }

  await logAudit("sync.compare", "node", sourceNodeId, targetNodeId, {
    sourceNodeId,
    targetNodeId,
    proxyAdded: addedProxyRules.length,
    proxyRemoved: removedProxyRules.length,
    proxyModified: modifiedProxyRules.length,
    certAdded: addedCerts.length,
    certRemoved: removedCerts.length,
    streamAdded: addedStreams.length,
    streamRemoved: removedStreams.length,
    redirectAdded: addedRedirects.length,
    redirectRemoved: removedRedirects.length,
  });

  return {
    proxyRules: {
      added: addedProxyRules,
      removed: removedProxyRules,
      modified: modifiedProxyRules,
      unchanged: unchangedProxyRules,
    },
    certs: {
      added: addedCerts,
      removed: removedCerts,
      unchanged: unchangedCerts,
    },
    streamProxies: {
      added: addedStreams,
      removed: removedStreams,
    },
    redirects: {
      added: addedRedirects,
      removed: removedRedirects,
    },
  };
}

export async function importNodeConfig(
  targetNodeId: string,
  config: NodeConfig,
  options: ImportOptions
): Promise<ImportResult> {
  const { node: targetNode, connector: targetConnector } = await getConnectorForNode(targetNodeId);

  const result: ImportResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  const [targetProxyRules, targetCerts, targetStreams, targetRedirects] =
    await Promise.all([
      targetConnector.listProxyRules(),
      targetConnector.listCerts(),
      targetConnector.listStreamProxies(),
      targetConnector.listRedirects(),
    ]);

  const targetProxyByDomain = new Map(
    targetProxyRules.map((rule) => [rule.RootOrMatchingDomain, rule])
  );
  const targetCertByDomain = new Map(targetCerts.map((cert) => [cert.Domain, cert]));
  const targetStreamByKey = new Map(
    targetStreams.map((stream) => [streamKey(stream), stream])
  );
  const targetRedirectByKey = new Map(
    targetRedirects.map((redirect) => [redirectKey(redirect), redirect])
  );

  for (const rule of config.proxyRules) {
    const domain = rule.RootOrMatchingDomain;
    const exists = targetProxyByDomain.get(domain);

    if (exists && options.skipExisting) {
      result.skipped += 1;
      continue;
    }

    if (exists && !options.overwrite) {
      result.skipped += 1;
      continue;
    }

    try {
      if (exists && options.overwrite) {
        await targetConnector.deleteProxyRule(domain);
      }

      const primaryOrigin = rule.ActiveOrigins?.[0] ?? rule.InactiveOrigins?.[0];
      if (!primaryOrigin || !primaryOrigin.OriginIpOrDomain) {
        throw new Error("No origin available in source rule");
      }

      await targetConnector.addProxyRule(
        rule.ProxyType,
        domain,
        primaryOrigin.OriginIpOrDomain,
        primaryOrigin.RequireTLS
      );

      if (Array.isArray(rule.MatchingDomainAlias) && rule.MatchingDomainAlias.length > 0) {
        await targetConnector.setDomainAliases(domain, rule.MatchingDomainAlias);
      }

      await targetConnector.editProxyRule(domain, {
        useStickySession: rule.UseStickySession,
        useActiveLoadBalance: rule.UseActiveLoadBalance,
        disabled: rule.Disabled,
        bypassGlobalTLS: rule.BypassGlobalTLS,
        tags: rule.Tags,
      });

      result.success += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(
        `Proxy rule '${domain}' failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  for (const cert of config.certs) {
    const domain = cert.Domain;
    const exists = targetCertByDomain.get(domain);

    if (exists && options.skipExisting) {
      result.skipped += 1;
      continue;
    }

    result.skipped += 1;
    result.errors.push(
      `Certificate '${domain}' skipped: export format does not include PEM/key material`
    );
  }

  for (const sourceStream of config.streamProxies) {
    const key = streamKey(sourceStream);
    if (!key) {
      result.failed += 1;
      result.errors.push("Stream skipped: invalid stream object");
      continue;
    }

    const existing = targetStreamByKey.get(key) as StreamLike | undefined;

    if (existing && options.skipExisting) {
      result.skipped += 1;
      continue;
    }

    if (existing && !options.overwrite) {
      result.skipped += 1;
      continue;
    }

    try {
      if (existing?.ID && options.overwrite) {
        await targetConnector.removeStreamProxy(existing.ID);
      }

      const streamConfig = toStreamConfig(sourceStream);
      if (!streamConfig) {
        throw new Error("Invalid stream structure");
      }

      await targetConnector.addStreamProxy(streamConfig);
      result.success += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(
        `Stream '${key}' failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  for (const sourceRedirect of config.redirects) {
    const key = redirectKey(sourceRedirect);
    if (!key) {
      result.failed += 1;
      result.errors.push("Redirect skipped: invalid redirect object");
      continue;
    }

    const existing = targetRedirectByKey.get(key) as RedirectLike | undefined;

    if (existing && options.skipExisting) {
      result.skipped += 1;
      continue;
    }

    if (existing && !options.overwrite) {
      result.skipped += 1;
      continue;
    }

    const redirectObj = sourceRedirect as RedirectLike;
    const destUrl = redirectObj.DestURL;
    const statusCode = redirectObj.StatusCode ?? 302;

    if (!destUrl) {
      result.failed += 1;
      result.errors.push(`Redirect '${key}' failed: missing destination URL`);
      continue;
    }

    try {
      if (existing?.ID && options.overwrite) {
        await targetConnector.deleteRedirect(existing.ID);
      }

      await targetConnector.addRedirect(key, destUrl, statusCode);

      if (redirectObj.ForwardChildpath) {
        const refreshed = await targetConnector.listRedirects();
        const created = (refreshed as RedirectLike[]).find(
          (item) => item.RedirectURL === key && item.DestURL === destUrl
        );

        if (created?.ID) {
          await targetConnector.editRedirect(
            created.ID,
            key,
            destUrl,
            statusCode,
            true
          );
        }
      }

      result.success += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(
        `Redirect '${key}' failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  if (Array.isArray(config.accessRules) && config.accessRules.length > 0) {
    result.skipped += config.accessRules.length;
    result.errors.push(
      "Access rules were skipped: creating access rule groups is not supported by current connector"
    );
  }

  await logAudit("sync.import", "node", targetNode.id, targetNode.id, {
    targetNodeName: targetNode.name,
    sourceNodeId: config.nodeId,
    sourceNodeName: config.nodeName,
    overwrite: options.overwrite,
    skipExisting: options.skipExisting,
    success: result.success,
    failed: result.failed,
    skipped: result.skipped,
  });

  return result;
}

export async function cloneNodeConfig(
  sourceNodeId: string,
  targetNodeId: string,
  options: CloneOptions
): Promise<CloneResult> {
  const exported = await exportNodeConfig(sourceNodeId);

  const filteredConfig: NodeConfig = {
    ...exported,
    proxyRules: options.proxyRules ? exported.proxyRules : [],
    certs: options.certs ? exported.certs : [],
    streamProxies: options.streams ? exported.streamProxies : [],
    redirects: options.redirects ? exported.redirects : [],
    accessRules: [],
  };

  const importResult = await importNodeConfig(targetNodeId, filteredConfig, {
    overwrite: true,
    skipExisting: false,
  });

  await logAudit("sync.clone", "node", sourceNodeId, targetNodeId, {
    sourceNodeId,
    targetNodeId,
    options,
    success: importResult.success,
    failed: importResult.failed,
    skipped: importResult.skipped,
  });

  return {
    success: importResult.success,
    failed: importResult.failed,
    errors: importResult.errors,
  };
}
