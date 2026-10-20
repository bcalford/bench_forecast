import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { CourtFetchError, courtPdf, courtText } from "./fetch-court";

const real = globalThis.fetch;
afterEach(() => { globalThis.fetch = real; });

// Replies in order; a thrown Error stands for a network failure.
function serve(...replies: (Response | Error)[]) {
  let calls = 0;
  globalThis.fetch = (async () => {
    const r = replies[Math.min(calls++, replies.length - 1)];
    if (r instanceof Error) throw r;
    return r.clone();
  }) as typeof fetch;
  return () => calls;
}
const pdf = () => new Response(new Uint8Array([37, 80, 68, 70]), { headers: { "content-type": "application/pdf" } });

describe("court fetches", () => {
  it("retry a network error and a 503, then succeed", async () => {
    const calls = serve(new TypeError("fetch failed"), new Response("", { status: 503 }), new Response("ok"));
    assert.equal(await courtText("https://x/a", { waitMs: 0 }), "ok");
    assert.equal(calls(), 3);
  });
  it("give up after three tries with the last error", async () => {
    const calls = serve(new TypeError("fetch failed"));
    await assert.rejects(courtText("https://x/a", { waitMs: 0 }), /fetch failed/);
    assert.equal(calls(), 3);
  });
  it("don't retry a 404, and report it as not found", async () => {
    const calls = serve(new Response("", { status: 404 }));
    await assert.rejects(courtPdf("https://x/a.pdf", { waitMs: 0 }), (e) => e instanceof CourtFetchError && e.notFound);
    assert.equal(calls(), 1);
  });
  it("treat an HTML page where a PDF was expected as an error, not a PDF", async () => {
    serve(new Response("<html>", { headers: { "content-type": "text/html" } }));
    await assert.rejects(courtPdf("https://x/a.pdf", { waitMs: 0 }), (e) => e instanceof CourtFetchError && !e.notFound);
  });
  it("return the PDF bytes", async () => {
    serve(pdf());
    assert.equal((await courtPdf("https://x/a.pdf", { waitMs: 0 })).length, 4);
  });
});
