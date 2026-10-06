import { describe, expect, it } from "vitest";
import { formatCalendarDate, formatDateTime, todayInBangkok } from "./format";

describe("formatCalendarDate", () => {
  it("shows the stored date, never the day before or after", () => {
    // Thai Buddhist-era year: 2026 -> 2569
    expect(formatCalendarDate("2026-10-05T00:00:00.000Z")).toContain("2569");
    expect(formatCalendarDate("2026-10-05T00:00:00.000Z")).toMatch(/\b5\b|๕/);
    expect(formatCalendarDate("2026-01-01T00:00:00.000Z")).toMatch(/\b1\b|๑/);
  });
});

describe("formatDateTime", () => {
  it("is Bangkok time: 17:30 UTC is 00:30 the next day", () => {
    const text = formatDateTime("2026-10-05T17:30:00.000Z");
    expect(text).toMatch(/\b6\b|๖/);
    expect(text).toContain("00:30");
  });
});

describe("todayInBangkok", () => {
  it("is YYYY-MM-DD", () => {
    expect(todayInBangkok()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
