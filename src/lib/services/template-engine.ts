const VARIABLE_PATTERN = /{{\s*([a-zA-Z0-9_.-]+)\s*}}/g;

function substituteInString(input: string, variables: Record<string, string>): string {
  return input.replace(VARIABLE_PATTERN, (_, variableName: string) => {
    return variables[variableName] ?? "";
  });
}

function substituteValue(value: unknown, variables: Record<string, string>): unknown {
  if (typeof value === "string") {
    return substituteInString(value, variables);
  }

  if (Array.isArray(value)) {
    return value.map((item) => substituteValue(item, variables));
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = substituteValue(nested, variables);
    }
    return output;
  }

  return value;
}

export function substituteVariables(
  config: Record<string, unknown>,
  variables: Record<string, string>
): Record<string, unknown> {
  return substituteValue(config, variables) as Record<string, unknown>;
}

function extractFromValue(value: unknown, variableSet: Set<string>) {
  if (typeof value === "string") {
    for (const match of value.matchAll(VARIABLE_PATTERN)) {
      if (match[1]) {
        variableSet.add(match[1]);
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      extractFromValue(item, variableSet);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      extractFromValue(nested, variableSet);
    }
  }
}

export function extractVariables(config: Record<string, unknown>): string[] {
  const variableSet = new Set<string>();
  extractFromValue(config, variableSet);
  return Array.from(variableSet).sort((a, b) => a.localeCompare(b));
}

export function validateVariables(
  config: Record<string, unknown>,
  variables: Record<string, string>
): { valid: boolean; missing: string[] } {
  const required = extractVariables(config);
  const missing = required.filter((name) => {
    const value = variables[name];
    return typeof value !== "string" || value.trim().length === 0;
  });

  return {
    valid: missing.length === 0,
    missing,
  };
}
