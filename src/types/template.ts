export type TemplateType =
  | "proxy_rule"
  | "redirect"
  | "access_rule"
  | "cert"
  | "stream"
  | "full";

export type DeploymentStatus =
  | "pending"
  | "deploying"
  | "deployed"
  | "failed"
  | "outdated";

export interface TemplateVariable {
  name: string;
  description: string;
  defaultValue?: string;
  required: boolean;
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string | null;
  type: TemplateType;
  config: Record<string, unknown>;
  variables: TemplateVariable[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateCreateInput {
  name: string;
  description?: string;
  type: TemplateType;
  config: Record<string, unknown>;
  variables?: TemplateVariable[];
  tags?: string[];
}

export interface TemplateDeployInput {
  nodeIds: string[];
  variables: Record<string, string>;
}

export interface TemplateDeployment {
  id: string;
  templateId: string;
  nodeId: string;
  variables: Record<string, string>;
  status: DeploymentStatus;
  deployedAt: string | null;
  error: string | null;
  createdAt: string;
}
