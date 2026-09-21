import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/sqlite";
import { initDatabaseSchema } from "@/lib/db/schema";
import { seedDatabaseIfEmpty } from "@/lib/db/seed";

export async function GET() {
  try {
    const db = getDatabase();
    initDatabaseSchema(db);
    seedDatabaseIfEmpty(db);

    const tablesCount = db.prepare("SELECT COUNT(*) as c FROM dining_tables").get() as { c: number };
    const usersCount = db.prepare("SELECT COUNT(*) as c FROM app_users").get() as { c: number };
    const itemsCount = db.prepare("SELECT COUNT(*) as c FROM menu_items").get() as { c: number };
    const ordersCount = db.prepare("SELECT COUNT(*) as c FROM orders").get() as { c: number };

    return NextResponse.json({
      status: "HEALTHY",
      service: "Kolhapuri Khanawal POS Core",
      timestamp: new Date().toISOString(),
      database: {
        engine: "SQLite (WAL Mode)",
        status: "CONNECTED",
        counts: {
          tables: tablesCount.c,
          users: usersCount.c,
          menuItems: itemsCount.c,
          orders: ordersCount.c,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "UNHEALTHY",
        error: error?.message || "Health check failed",
      },
      { status: 500 }
    );
  }
}
