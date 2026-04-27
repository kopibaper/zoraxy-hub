export interface Certificate {
  Domain: string;
  LastModifiedDate: string;
  ExpireDate: string;
  RemainingDays: number;
  UseDNS: boolean;
  IsSelfSigned: boolean;
}

export interface CertUploadInput {
  domain: string;
  certPem: string;
  keyPem: string;
}

export interface AcmeObtainInput {
  domains: string[];
  email: string;
  dnsProvider?: string;
  dnsCredentials?: Record<string, string>;
}

export interface AcmeAutoRenewConfig {
  enabled: boolean;
  email: string;
  domains: string[];
}
