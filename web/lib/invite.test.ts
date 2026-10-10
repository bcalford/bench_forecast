import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CODE_ALPHABET, newCode, parseArgs } from "./invite";
import { CODE_RE } from "./filing";

describe("newCode", () => {
  it("uses 32 easy-to-read characters: no 0, O, 1 or I", () => {
    assert.equal(CODE_ALPHABET.length, 32);
    assert.equal(new Set(CODE_ALPHABET).size, 32);
    for (const ch of "0O1I") assert.ok(!CODE_ALPHABET.includes(ch));
  });
  it("makes codes in the table's format", () => {
    for (let i = 0; i < 200; i++) assert.ok(CODE_RE.test(newCode()));
  });
  it("draws every character from the alphabet", () => {
    let n = 0;
    assert.equal(newCode(() => n++ % 32), "BF-ABCD-EFGH");
    assert.equal(newCode(() => 31), "BF-9999-9999");
  });
});

describe("parseArgs", () => {
  it("new: defaults to 3 runs and no note", () => {
    assert.deepEqual(parseArgs(["new"]), { kind: "new", runs: 3, note: null });
  });
  it("new: reads --runs and --note in any order", () => {
    assert.deepEqual(parseArgs(["new", "--note", "Sam, law school", "--runs", "5"]), { kind: "new", runs: 5, note: "Sam, law school" });
  });
  it("rejects bad run counts and unknown options", () => {
    assert.throws(() => parseArgs(["new", "--runs", "0"]), /whole number of runs/);
    assert.throws(() => parseArgs(["new", "--runs", "2.5"]), /whole number of runs/);
    assert.throws(() => parseArgs(["new", "--runs"]), /whole number of runs/);
    assert.throws(() => parseArgs(["new", "--colour", "blue"]), /Unknown option/);
  });
  it("on, off and runs take a code, normalized", () => {
    assert.deepEqual(parseArgs(["off", "bf7q2km4xd"]), { kind: "off", code: "BF-7Q2K-M4XD" });
    assert.deepEqual(parseArgs(["on", "BF-7Q2K-M4XD"]), { kind: "on", code: "BF-7Q2K-M4XD" });
    assert.deepEqual(parseArgs(["runs", "BF-7Q2K-M4XD", "6"]), { kind: "runs", code: "BF-7Q2K-M4XD", runs: 6 });
    assert.throws(() => parseArgs(["off"]), /is not an invite code/);
    assert.throws(() => parseArgs(["off", "hello"]), /is not an invite code/);
  });
  it("list and spend take nothing; anything else prints usage", () => {
    assert.deepEqual(parseArgs(["list"]), { kind: "list" });
    assert.deepEqual(parseArgs(["spend"]), { kind: "spend" });
    assert.throws(() => parseArgs([]), /Usage: npm run invite/);
    assert.throws(() => parseArgs(["delete", "BF-7Q2K-M4XD"]), /Usage: npm run invite/);
  });
});
