import type { ZoraxySession, ZoraxyConnectionConfig } from "./types";

const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes — refresh aggressively to avoid stale CSRF tokens

const sessionCache = new Map<string, ZoraxySession>();

function cacheKey(config: ZoraxyConnectionConfig): string {
  return `${config.protocol}://${config.host}:${config.port}`;
}

export async function getSession(
  config: ZoraxyConnectionConfig
): Promise<ZoraxySession> {
  const key = cacheKey(config);
  const cached = sessionCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  const session = await authenticate(config);
  sessionCache.set(key, session);
  return session;
}

/**
 * Zoraxy uses Gorilla CSRF (double-submit cookie pattern):
 *
 * 1. GET any HTML page (e.g. /login.html) → server sets `zoraxy_csrf` cookie
 *    AND embeds a CSRF token in `<meta name="zoraxy.csrf.Token" content="...">`.
 *
 * 2. For POST/PUT/DELETE requests, you must send:
 *    - The `zoraxy_csrf` cookie (from step 1)
 *    - The `X-CSRF-Token` header with the meta-tag token value
 *
 * 3. After successful login, the same cookie is reused for the session.
 *    Subsequent API calls need the cookie; GET requests don't need the header,
 *    but POST/PUT/DELETE still need a valid X-CSRF-Token.
 */
export async function authenticate(
  config: ZoraxyConnectionConfig
): Promise<ZoraxySession> {
  const baseUrl = `${config.protocol}://${config.host}:${config.port}`;

  // For noauth mode, just verify the instance is reachable
  if (config.noauth) {
    const checkResponse = await fetch(`${baseUrl}/api/auth/checkLogin`, {
      method: "GET",
      signal: AbortSignal.timeout(10000),
    });

    if (!checkResponse.ok) {
      throw new Error(
        `Zoraxy instance not reachable (${checkResponse.status})`
      );
    }

    return {
      cookie: "",
      csrfToken: "",
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
  }

  // ── Step 1: GET login page to obtain CSRF cookie + token ──
  const pageResponse = await fetch(`${baseUrl}/login.html`, {
    method: "GET",
    signal: AbortSignal.timeout(10000),
  });

  if (!pageResponse.ok) {
    throw new Error(
      `Cannot reach Zoraxy login page (HTTP ${pageResponse.status})`
    );
  }

  // Extract zoraxy_csrf cookie from Set-Cookie header
  const setCookieHeader = pageResponse.headers.get("set-cookie");
  if (!setCookieHeader) {
    throw new Error("Zoraxy did not return a CSRF cookie on login page");
  }
  // Cookie format: "zoraxy_csrf=<value>; Path=/; Expires=...; HttpOnly; SameSite=Lax"
  const csrfCookie = setCookieHeader.split(";")[0]; // "zoraxy_csrf=<value>"

  // Extract CSRF token from <meta name="zoraxy.csrf.Token" content="...">
  const html = await pageResponse.text();
  const csrfMatch = html.match(
    /zoraxy\.csrf\.Token[^>]*content="([^"]+)"/
  );
  if (!csrfMatch) {
    throw new Error(
      "Cannot extract CSRF token from Zoraxy login page HTML"
    );
  }
  const csrfToken = csrfMatch[1];

  // ── Step 2: POST login with CSRF cookie + header + form-encoded creds ──
  const formBody = new URLSearchParams();
  formBody.append("username", config.username || "");
  formBody.append("password", config.password || "");

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookie,
      "X-CSRF-Token": csrfToken,
    },
    body: formBody.toString(),
    redirect: "manual",
    signal: AbortSignal.timeout(10000),
  });

  // Read response body
  const responseText = await loginResponse.text();

  // 403 = CSRF validation failed (shouldn't happen with correct flow)
  if (loginResponse.status === 403) {
    throw new Error(`Zoraxy CSRF validation failed: ${responseText}`);
  }

  // Check for error in JSON response body (e.g. {"error":"Invalid username or password"})
  if (responseText.startsWith("{")) {
    try {
      const body = JSON.parse(responseText);
      if (body && body.error) {
        throw new Error(`Zoraxy login rejected: ${body.error}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Zoraxy")) throw e;
    }
  }

  const loginSetCookie = loginResponse.headers.get("set-cookie");
  const sessionCookie = loginSetCookie
    ? loginSetCookie.split(";")[0]
    : "";

  // Gorilla CSRF validates the X-CSRF-Token header against the zoraxy_csrf cookie.
  // Both the zoraxy_csrf cookie AND the Zoraxy session cookie must be sent together.
  const combinedCookies = sessionCookie
    ? `${csrfCookie}; ${sessionCookie}`
    : csrfCookie;

  return {
    cookie: combinedCookies,
    csrfToken,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
}

export function clearSession(config: ZoraxyConnectionConfig): void {
  sessionCache.delete(cacheKey(config));
}

export function clearAllSessions(): void {
  sessionCache.clear();
}
