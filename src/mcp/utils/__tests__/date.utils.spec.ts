/**
 * @jest-environment <rootDir>/test/jest-environments/timezone.environment.ts
 * @jest-environment-options {"timeZone": "America/Los_Angeles"}
 */

import { addDaysToDayKey, localDayStartMs, toLocalDayKey } from "../date.utils";

describe("toLocalDayKey", () => {
  it("resolves an instant to the previous local day when UTC is already the next day", () => {
    // 2026-06-15 04:30 UTC = 2026-06-14 21:30 PDT
    expect(toLocalDayKey(Date.UTC(2026, 5, 15, 4, 30))).toBe("2026-06-14");
  });

  it("resolves an instant to the same local day", () => {
    // 2026-06-13 19:00 UTC = 2026-06-13 12:00 PDT
    expect(toLocalDayKey(Date.UTC(2026, 5, 13, 19))).toBe("2026-06-13");
  });

  it("applies a non-zero rollover hour", () => {
    // 2026-06-15 19:00 UTC minus 4h rollover = 2026-06-15 08:00 PDT
    expect(toLocalDayKey(Date.UTC(2026, 5, 15, 19), 4)).toBe("2026-06-15");
    // 2026-06-15 09:00 UTC (02:00 PDT) minus 4h rollover falls before rollover
    expect(toLocalDayKey(Date.UTC(2026, 5, 15, 9), 4)).toBe("2026-06-14");
  });

  it("pads single-digit month and day", () => {
    // 2026-01-05 20:00 UTC = 2026-01-05 12:00 PST
    expect(toLocalDayKey(Date.UTC(2026, 0, 5, 20))).toBe("2026-01-05");
  });
});

describe("localDayStartMs", () => {
  it("returns the UTC instant of local midnight", () => {
    expect(localDayStartMs("2026-06-15")).toBe(Date.UTC(2026, 5, 15, 7));
  });

  it("applies a non-zero rollover hour", () => {
    expect(localDayStartMs("2026-06-15", 4)).toBe(Date.UTC(2026, 5, 15, 11));
  });

  it("round-trips with toLocalDayKey", () => {
    expect(toLocalDayKey(localDayStartMs("2026-06-15"))).toBe("2026-06-15");
    expect(toLocalDayKey(localDayStartMs("2026-06-15") - 1)).toBe("2026-06-14");
  });

  it(
    "should round-trip with toLocalDayKey across DST changes for any " +
      "rollover hour",
    () => {
      const dayKeys = [
        "2026-03-07",
        "2026-03-08",
        "2026-03-09",
        "2026-10-31",
        "2026-11-01",
        "2026-11-02",
      ];

      for (const rolloverHour of [0, 4]) {
        for (const dayKey of dayKeys) {
          const start = localDayStartMs(dayKey, rolloverHour);
          expect(toLocalDayKey(start, rolloverHour)).toBe(dayKey);
          expect(toLocalDayKey(start - 1, rolloverHour)).toBe(
            addDaysToDayKey(dayKey, -1),
          );
        }
      }
    },
  );
});

describe("addDaysToDayKey", () => {
  it("shifts back across a month boundary", () => {
    expect(addDaysToDayKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("shifts forward across a year boundary", () => {
    expect(addDaysToDayKey("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("shifts back onto a leap day", () => {
    expect(addDaysToDayKey("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("does not skip or repeat a day across the US DST change", () => {
    expect(addDaysToDayKey("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDaysToDayKey("2026-03-09", -1)).toBe("2026-03-08");
  });

  it("returns the same key for a zero shift", () => {
    expect(addDaysToDayKey("2026-06-15", 0)).toBe("2026-06-15");
  });
});
