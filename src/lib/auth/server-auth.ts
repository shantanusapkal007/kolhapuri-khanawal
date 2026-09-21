/**
 * Authoritative Server-Side Auth Verification Helper for API Routes & Middleware
 */

import { NextRequest } from "next/server";
import { verifySessionToken, SessionUser } from "@/lib/db/auth-service";

export function getAuthenticatedUser(request: NextRequest | Request): SessionUser | null {
  try {
    // 1. Check Authorization: Bearer <token>
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const result = verifySessionToken(token);
      if (result.valid && result.user) {
        return result.user;
      }
    }

    // 2. Check auth_session Cookie
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const cookies = cookieHeader.split(";").map((c) => c.trim());
      for (const cookie of cookies) {
        if (cookie.startsWith("auth_session=")) {
          const token = cookie.substring("auth_session=".length).trim();
          const result = verifySessionToken(token);
          if (result.valid && result.user) {
            return result.user;
          }
        }
      }
    }
  } catch {}

  return null;
}
