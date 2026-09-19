import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore, KHANAWAL_TABLE_CONFIGS } from "@/lib/store/restaurant-store";

describe("11 Named Dining Tables & Sections (A1..A3, B1..B4, C1..C4)", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("1. Initializes exactly 11 tables with correct names, sections, and capacities", () => {
    expect(store.tables).toHaveLength(11);
    expect(store.settings.dining.totalTables).toBe(11);

    const expectedNames = [
      "A1", "A2", "A3",
      "B1", "B2", "B3", "B4",
      "C1", "C2", "C3", "C4",
    ];

    expect(store.tables.map((t) => t.name)).toEqual(expectedNames);
    expect(store.tables.map((t) => t.tableNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

    // Section A (3 tables)
    const sectionA = store.tables.filter((t) => t.section === "SECTION_A");
    expect(sectionA).toHaveLength(3);
    expect(sectionA.map((t) => t.name)).toEqual(["A1", "A2", "A3"]);

    // Section B (4 tables)
    const sectionB = store.tables.filter((t) => t.section === "SECTION_B");
    expect(sectionB).toHaveLength(4);
    expect(sectionB.map((t) => t.name)).toEqual(["B1", "B2", "B3", "B4"]);

    // Section C (4 tables)
    const sectionC = store.tables.filter((t) => t.section === "SECTION_C");
    expect(sectionC).toHaveLength(4);
    expect(sectionC.map((t) => t.name)).toEqual(["C1", "C2", "C3", "C4"]);
  });

  it("2. Resolves table names via store.getTableName(tableNumber)", () => {
    expect(store.getTableName(1)).toBe("A1");
    expect(store.getTableName(2)).toBe("A2");
    expect(store.getTableName(3)).toBe("A3");
    expect(store.getTableName(4)).toBe("B1");
    expect(store.getTableName(5)).toBe("B2");
    expect(store.getTableName(6)).toBe("B3");
    expect(store.getTableName(7)).toBe("B4");
    expect(store.getTableName(8)).toBe("C1");
    expect(store.getTableName(9)).toBe("C2");
    expect(store.getTableName(10)).toBe("C3");
    expect(store.getTableName(11)).toBe("C4");
    expect(store.getTableName(0)).toBe("");
  });

  it("3. Finds tables by name, number, or case-insensitive string via store.findTable", () => {
    expect(store.findTable("a1")?.name).toBe("A1");
    expect(store.findTable("B3")?.tableNumber).toBe(6);
    expect(store.findTable("c4")?.tableNumber).toBe(11);
    expect(store.findTable(4)?.name).toBe("B1");
    expect(store.findTable("Table A2")?.tableNumber).toBe(2);
    expect(store.findTable(99)).toBeUndefined();
  });

  it("4. Creates party at Table A1 (tableNumber 1) and sets tableName to A1", () => {
    const party = store.createPartyAtTable(1, 2, "VIP Table");
    expect(party.tableNumber).toBe(1);
    expect(party.tableName).toBe("A1");

    const tableA1 = store.tables.find((t) => t.tableNumber === 1)!;
    expect(tableA1.status).toBe("OCCUPIED");
    expect(tableA1.name).toBe("A1");
  });

  it("5. Transfers party to Table B2 (tableNumber 5) and updates occupancy", () => {
    const party = store.createPartyAtTable(2, 2, "Initial A2");
    expect(store.tables.find((t) => t.tableNumber === 2)?.status).toBe("OCCUPIED");

    // Move from A2 (2) to B2 (5)
    store.transferPartyToTable(party.id, 5);

    expect(store.tables.find((t) => t.tableNumber === 2)?.status).toBe("AVAILABLE");
    expect(store.tables.find((t) => t.tableNumber === 5)?.status).toBe("OCCUPIED");

    const updatedParty = store.parties.find((p) => p.id === party.id)!;
    expect(updatedParty.tableNumber).toBe(5);
  });

  it("6. System reset restores exactly the 11 named tables", () => {
    store.tables = [];
    store.resetToSeedData();

    expect(store.tables).toHaveLength(11);
    expect(store.tables[0].name).toBe("A1");
    expect(store.tables[10].name).toBe("C4");
  });
});
