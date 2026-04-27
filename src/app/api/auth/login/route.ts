import { NextRequest } from "next/server";
import { createToken, getAdminCredentials, verifyPassword } from "@/lib/auth/session";
import { errorResponse, ValidationError, AuthenticationError } from "@/lib/errors";
import { initializeDatabase } from "@/lib/db";

initializeDatabase();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      throw new ValidationError("Username and password are required");
    }

    const admin = getAdminCredentials();

    if (username !== admin.username || !verifyPassword(password, admin.passwordHash)) {
      throw new AuthenticationError("Invalid username or password");
    }

    const token = await createToken(username);

    const response = Response.json({
      success: true,
      data: { token, username },
    });

    response.headers.set(
      "Set-Cookie",
      `zoraxyhub_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
    );

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
