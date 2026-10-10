import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CODE_RE, normalizeCode, reasonMessage, isCodeReason, HOLD_USD } from "./filing";

describe("normalizeCode", () => {
  it("accepts lowercase, spaces and missing dashes", () => {
    assert.equal(normalizeCode("bf-7q2k-m4xd"), "BF-7Q2K-M4XD");
    assert.equal(normalizeCode("BF7Q2KM4XD"), "BF-7Q2K-M4XD");
    assert.equal(normalizeCode(" bf 7q2k m4xd "), "BF-7Q2K-M4XD");
    assert.equal(normalizeCode("BF-7Q2KM4XD"), "BF-7Q2K-M4XD");
  });
  it("leaves something that isn't a code alone (upper-cased, trimmed) so the format check can explain", () => {
    assert.equal(normalizeCode(" bf-7q2k "), "BF-7Q2K");
    assert.equal(normalizeCode("hello"), "HELLO");
    assert.equal(normalizeCode(""), "");
  });
  it("produces strings CODE_RE accepts only when complete", () => {
    assert.ok(CODE_RE.test(normalizeCode("bf7q2km4xd")));
    assert.ok(!CODE_RE.test(normalizeCode("bf7q2km4x")));
  });
});

describe("reasonMessage", () => {
  it("words each refusal as the spec says", () => {
    assert.equal(reasonMessage("unknown"), "That invite code wasn't recognized. Codes look like BF-7Q2K-M4XD.");
    assert.equal(reasonMessage("inactive"), "That invite code has been turned off.");
    assert.equal(reasonMessage("used_up", 3), "That invite code has used all 3 of its runs.");
    assert.equal(reasonMessage("used_up", null), "That invite code has used all of its runs.");
    assert.equal(reasonMessage("cap"), "Today's forecasting budget is spent. Filing reopens at midnight Eastern.");
  });
  it("tells code problems from budget problems", () => {
    assert.ok(isCodeReason("unknown") && isCodeReason("inactive") && isCodeReason("used_up"));
    assert.ok(!isCodeReason("cap") && !isCodeReason("ok") && !isCodeReason(undefined));
  });
  it("holds $2.50 per run in flight", () => assert.equal(HOLD_USD, 2.5));
});
