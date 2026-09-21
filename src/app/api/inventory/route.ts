import { NextRequest, NextResponse } from "next/server";
import { InventoryRepository } from "@/lib/db/inventory-repository";
import { getAuthenticatedUser } from "@/lib/auth/server-auth";
import { getDatabase } from "@/lib/db/sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";

function ensureDb() {
  const db = getDatabase();
  initDatabaseSchema(db);
  seedDatabaseIfEmpty(db);
}

/**
 * GET /api/inventory
 * Fetch all raw ingredients and stock levels
 */
export async function GET(request: NextRequest) {
  try {
    ensureDb();
    const ingredients = InventoryRepository.getAllIngredients();
    return NextResponse.json({ success: true, ingredients });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory
 * Adjust stock atomically
 */
export async function POST(request: NextRequest) {
  try {
    ensureDb();
    const user = getAuthenticatedUser(request);
    const body = await request.json();
    const { ingredientId, adjustmentQuantity, type, notes } = body || {};

    if (!ingredientId || adjustmentQuantity === undefined || !type) {
      return NextResponse.json(
        { success: false, error: "ingredientId, adjustmentQuantity, and type are required" },
        { status: 400 }
      );
    }

    const performedBy = user?.name || body?.performedBy || "Manager Vikram";

    const updated = InventoryRepository.adjustStock({
      ingredientId,
      adjustmentQuantity: Number(adjustmentQuantity),
      type,
      performedBy,
      notes,
    });

    return NextResponse.json({ success: true, ingredient: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Inventory adjustment failed" },
      { status: 500 }
    );
  }
}
