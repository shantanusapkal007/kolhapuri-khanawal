import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/lib/db/auth-service";
import { getDatabase } from "@/lib/db/sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";

export async function POST(request: NextRequest) {
  try {
    const db = getDatabase();
    initDatabaseSchema(db);
    seedDatabaseIfEmpty(db);

    const body = await request.json();
    const { username, pin } = body || {};

    if (!username && !pin) {
      return NextResponse.json(
        { success: false, error: "Username and PIN are required" },
        { status: 400 }
      );
    }

    const authResult = authenticateUser(username || pin, pin || username);
    if (!authResult.success || !authResult.session) {
      return NextResponse.json(
        { success: false, error: authResult.error || "Invalid credentials" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      user: {
        id: authResult.session.userId,
        username: authResult.session.username,
        name: authResult.session.name,
        role: authResult.session.role,
      },
      token: authResult.session.token,
    });

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: "auth_session",
      value: authResult.session.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Authentication failed" },
      { status: 500 }
    );
  }
}
