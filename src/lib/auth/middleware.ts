import { NextRequest } from "next/server";
import { verifyToken } from "./session";
import { AuthenticationError } from "../errors";

export async function requireAuth(
  request: NextRequest
): Promise<{ username: string }> {
  const authHeader = request.headers.get("authorization");
  let token: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  if (!token) {
    token = request.cookies.get("zoraxyhub_token")?.value || null;
  }

  if (!token) {
    throw new AuthenticationError("No authentication token provided");
  }

  const payload = await verifyToken(token);
  if (!payload) {
    throw new AuthenticationError("Invalid or expired token");
  }

  return payload;
}
