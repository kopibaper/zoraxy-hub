export interface ProxyOrigin {
  OriginIpOrDomain: string;
  RequireTLS: boolean;
  SkipCertValidations: boolean;
  SkipWebSocketOriginCheck: boolean;
  Weight: number;
  Disabled: boolean;
}

export interface VirtualDirectory {
  MatchingPath: string;
  Domain: string;
  RequireTLS: boolean;
  SkipCertValidations: boolean;
  Disabled: boolean;
}

export interface HeaderRewriteRule {
  Key: string;
  Value: string;
  Direction: "request" | "response";
  IsRemove: boolean;
}

export interface TlsOptions {
  MinVersion: string;
  MaxVersion: string;
}

export interface ProxyRule {
  ProxyType: "subd" | "vdir";
  RootOrMatchingDomain: string;
  MatchingDomainAlias: string[];
  ActiveOrigins: ProxyOrigin[];
  InactiveOrigins: ProxyOrigin[];
  UseStickySession: boolean;
  UseActiveLoadBalance: boolean;
  Disabled: boolean;
  BypassGlobalTLS: boolean;
  TlsOptions: TlsOptions | null;
  VirtualDirectories: VirtualDirectory[];
  HeaderRewriteRules: HeaderRewriteRule[];
  Tags: string[];
}

export interface ProxyRuleCreateInput {
  proxyType: "subd" | "vdir";
  rootOrMatchingDomain: string;
  origins: {
    ip: string;
    requireTLS: boolean;
    skipCertValidation?: boolean;
    weight?: number;
  }[];
  useStickySession?: boolean;
  useActiveLoadBalance?: boolean;
  bypassGlobalTLS?: boolean;
  tags?: string[];
}

export interface ProxyRuleUpdateInput {
  origins?: {
    ip: string;
    requireTLS: boolean;
    skipCertValidation?: boolean;
    weight?: number;
  }[];
  useStickySession?: boolean;
  useActiveLoadBalance?: boolean;
  disabled?: boolean;
  bypassGlobalTLS?: boolean;
  tags?: string[];
}

export interface UpstreamEntry {
  OriginIpOrDomain: string;
  RequireTLS: boolean;
  SkipCertValidations: boolean;
  SkipWebSocketOriginCheck: boolean;
  Weight: number;
  Disabled: boolean;
}

export interface UpstreamAddInput {
  origin: string;
  requireTLS: boolean;
  skipCertValidation?: boolean;
  weight?: number;
}
