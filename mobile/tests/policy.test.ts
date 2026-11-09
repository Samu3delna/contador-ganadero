import { offlineValid, OFFLINE_TTL, scopeId } from "../src/lib/offlinePolicy";
import { amount, civilDate } from "../src/utils/forms";
test("caduca exactamente a siete días y rechaza reloj atrasado", () => {
  expect(offlineValid(100, 100 + OFFLINE_TTL - 1)).toBe(true);
  expect(offlineValid(100, 100 + OFFLINE_TTL)).toBe(false);
  expect(offlineValid(100, 99)).toBe(false);
});
test("separa usuario y tenant", () => {
  const a = { _id: "a".repeat(24), tenantId: "b".repeat(24) };
  expect(scopeId(a)).not.toBe(scopeId({ ...a, tenantId: "c".repeat(24) }));
  expect(scopeId(a)).not.toBe(scopeId({ ...a, _id: "c".repeat(24) }));
  expect(() => scopeId({ ...a, tenantId: "../x" })).toThrow();
});
test("rechaza montos no finitos y fechas imposibles", () => {
  expect(amount("12,50")).toBe(12.5);
  for (const v of ["", "-1", "Infinity", "1.000.000"])
    expect(() => amount(v)).toThrow();
  expect(() => civilDate("2026-02-30")).toThrow();
  expect(civilDate("2026-11-07")).toBe("2026-11-07");
});
