import { describe, it, expect, beforeEach } from "vitest";
import { RestaurantStore } from "@/lib/store/restaurant-store";

describe("Phase 23: Staff Attendance & Salary Calculation", () => {
  let store: RestaurantStore;

  beforeEach(() => {
    store = new RestaurantStore();
  });

  it("should calculate ₹0 gross salary when an employee has 0 attendance records", () => {
    const employee = store.employees[0]; // Prakash Shinde, baseSalary: 22000
    // Ensure no attendance records for month 2026-11
    const salary = store.calculateStaffSalary(employee.id, "2026-11");

    expect(salary.presentDays).toBe(0);
    expect(salary.calculatedGross).toBe(0);
    expect(salary.payableSalary).toBe(0);
  });

  it("should count full days and half days correctly (full = 1, half = 0.5)", () => {
    const employee = store.employees[1]; // Tanaji Patil, baseSalary: 18000
    const month = "2026-10";

    // Mark 10 full days
    for (let day = 1; day <= 10; day++) {
      const dateStr = `${month}-${String(day).padStart(2, "0")}`;
      store.attendance.push({
        id: `att-test-${day}`,
        employeeId: employee.id,
        employeeName: employee.name,
        date: dateStr,
        status: "PRESENT",
        markedAt: new Date().toISOString(),
      });
    }

    // Mark 4 half days
    for (let day = 11; day <= 14; day++) {
      const dateStr = `${month}-${String(day).padStart(2, "0")}`;
      store.attendance.push({
        id: `att-test-${day}`,
        employeeId: employee.id,
        employeeName: employee.name,
        date: dateStr,
        status: "HALF_DAY",
        markedAt: new Date().toISOString(),
      });
    }

    // Total effective days = 10 + (4 * 0.5) = 12 days
    // Base salary = 18000 -> Daily rate = 18000 / 30 = 600 -> Gross = 600 * 12 = 7200
    const salary = store.calculateStaffSalary(employee.id, month);

    expect(salary.presentDays).toBe(12);
    expect(salary.calculatedGross).toBe(7200);
  });
});
