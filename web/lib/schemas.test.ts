import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkCitations, type JusticeOpinion } from "./schemas";
import { costUsd } from "./models";

const opinion = (citations: JusticeOpinion["citations"]): JusticeOpinion => ({
  vote: "reverse", confidence: 0.8, role: "majority", brief_reason: "", detailed_reason: "", citations,
});

const RETRIEVED = new Map([
  ["p1", "What a statute means is a question for the courts."],
  ["p2", "Congress “alone has access to the pockets of the people.”"],
]);

describe("checkCitations", () => {
  it("accepts a citation whose passage was retrieved and whose quote appears in it", () => {
    const r = checkCitations(opinion([{ passage_id: "p1", quote: "a question for the courts", why: "" }]), RETRIEVED);
    assert.equal(r.valid.length, 1);
    assert.equal(r.invalid.length, 0);
  });

  it("rejects an invented passage id", () => {
    const r = checkCitations(opinion([{ passage_id: "p999", quote: "anything", why: "" }]), RETRIEVED);
    assert.equal(r.invalid.length, 1);
    assert.match(r.invalid[0].reason, /not among those retrieved/);
  });

  it("rejects a quote that is not in the cited passage", () => {
    const r = checkCitations(opinion([{ passage_id: "p1", quote: "Chevron is overruled", why: "" }]), RETRIEVED);
    assert.match(r.invalid[0].reason, /quote does not appear/);
  });

  it("matches quotes despite curly quotes, case and spacing differences", () => {
    const r = checkCitations(opinion([{ passage_id: "p2", quote: 'alone has access to the  pockets of the People."', why: "" }]), RETRIEVED);
    assert.equal(r.valid.length, 1);
  });
});

describe("costUsd", () => {
  it("prices Opus 5.5 input, output and cache tokens", () => {
    const usage = { input_tokens: 1_000_000, output_tokens: 100_000, cache_creation_input_tokens: 0, cache_read_input_tokens: 1_000_000 } as Parameters<typeof costUsd>[1];
    assert.equal(costUsd("claude-opus-5-5", usage).toFixed(2), (4 + 2 + 0.2).toFixed(2));
  });

  it("refuses to price an unknown model rather than recording zero", () => {
    assert.throws(() => costUsd("claude-unknown", { input_tokens: 1, output_tokens: 1 } as Parameters<typeof costUsd>[1]));
  });
});
