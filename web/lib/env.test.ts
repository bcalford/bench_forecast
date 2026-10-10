import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCap, DEFAULT_DAILY_CAP_USD } from "./env";

describe("parseCap", () => {
  it("uses the $10 default when the variable is missing or blank", () => {
    assert.equal(DEFAULT_DAILY_CAP_USD, 10);
    assert.equal(parseCap(undefined), 10);
    assert.equal(parseCap("  "), 10);
  });
  it("reads a number", () => {
    assert.equal(parseCap("10"), 10);
    assert.equal(parseCap("12.5"), 12.5);
    assert.equal(parseCap("0"), 0);
  });
  it("closes filing (0) rather than lifting the cap when the value is unreadable or negative", () => {
    assert.equal(parseCap("ten"), 0);
    assert.equal(parseCap("-5"), 0);
    assert.equal(parseCap("Infinity"), 0);
  });
});
