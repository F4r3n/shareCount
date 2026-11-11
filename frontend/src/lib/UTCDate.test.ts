import { describe, expect, it } from "vitest";
import { localDay, parseUTC } from "./UTCDate";

describe("parseUTC", () => {
  it("parses padded values as UTC", () => {
    expect(parseUTC("2026-11-11T09:05:03.250000")).toBe(Date.UTC(2026, 10, 11, 9, 5, 3, 250));
  });
  it("parses legacy unpadded values", () => {
    expect(parseUTC("2026-11-11T9:5:3.000000")).toBe(Date.UTC(2026, 10, 11, 9, 5, 3));
  });
  it("orders legacy and padded values consistently", () => {
    expect(parseUTC("2026-11-11T9:5:3.000000")).toBeLessThan(parseUTC("2026-11-11T10:00:00.000"));
  });
  it("returns 0 for garbage", () => {
    expect(parseUTC("not a date")).toBe(0);
  });
});

describe("localDay", () => {
  it("keeps the calendar day in local time", () => {
    const d = localDay("2026-11-11");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 10, 11]);
  });
});
