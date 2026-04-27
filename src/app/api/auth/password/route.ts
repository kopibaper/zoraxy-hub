import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { errorResponse, AuthenticationError } from "@/lib/errors";
import { verifyPassword, getAdminCredentials } from "@/lib/auth/session";

export async function PUT(request: NextRequest) {
  try {
    await requireAuth(request);
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return Response.json(
        { success: false, error: "Current and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return Response.json(
        { success: false, error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const { passwordHash } = getAdminCredentials();
    const isValid = verifyPassword(currentPassword, passwordHash);
    if (!isValid) {
      throw new AuthenticationError("Current password is incorrect");
    }

    return Response.json({
      success: true,
      data: {
        message:
          "Password change noted. Update ADMIN_PASSWORD in your environment variables and restart the server.",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
