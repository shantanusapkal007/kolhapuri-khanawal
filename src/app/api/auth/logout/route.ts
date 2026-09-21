import { NextRequest, NextResponse } from "next/server";
import { invalidateSession } from "@/lib/db/auth-service";

export async function POST(request: NextRequest) {
  try {
    let token: string | undefined;

    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else {
      const cookie = request.cookies.get("auth_session");
      if (cookie) token = cookie.value;
    }

    if (token) {
      invalidateSession(token);
    }

    const response = NextResponse.json({ success: true, message: "Logged out successfully" });
    response.cookies.delete("auth_session");
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Logout failed" },
      { status: 500 }
    );
  }
}
