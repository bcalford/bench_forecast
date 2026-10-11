// The decision review queue and manual runs of the decision job (spec §2).
//   npm run outcomes -- review
//   npm run outcomes -- confirm 25-170
//   npm run outcomes -- set 25-170 --judgment reversed --majority roberts,thomas,… --dissent kagan,… [--author roberts] [--recused alito]
//   npm run outcomes -- run [--term 24] [--dry-run]
import type { Vote } from "../../lib/clerk-rules";
import { justices } from "../../lib/court";
import { currentTerm, normalizeDocket } from "../../lib/court-site";
import { scoreCase } from "../../lib/outcomes";
import { serviceClient } from "../../lib/supabase";
import { prodInngest } from "./prod-inngest";

const db = serviceClient();
const SLUGS = new Set(justices.map((j) => j.slug));
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const list = (s?: string) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

async function caseFor(docket: string) {
  const d = normalizeDocket(docket);
  if (!d) throw new Error(`"${docket}" is not a docket number.`);
  const { data, error } = await db.from("cases").select("id, title").eq("docket", d).eq("term", "October Term 2026");
  if (error) throw new Error(error.message);
  if (!data.length) throw new Error(`No October Term 2026 case with docket ${d}.`);
  return data;
}

async function main() {
  const [cmd, docketArg] = process.argv.slice(2);
  switch (cmd) {
    case "review": {
      const { data, error } = await db.from("outcomes").select("decided_at, outcome, votes, author, notes, source_url, cases(docket, title)").eq("status", "needs_review");
      if (error) throw new Error(error.message);
      if (!data.length) return console.log("Nothing waiting for review.");
      for (const o of data as unknown as { decided_at: string; outcome: string; votes: Record<string, Vote>; author: string | null; notes: string | null; source_url: string | null; cases: { docket: string; title: string } }[]) {
        console.log(`\n${o.cases.docket}  ${o.cases.title}  (decided ${o.decided_at})`);
        console.log(`  best guess: ${o.outcome}; author ${o.author ?? "none"}`);
        console.log(`  votes: ${Object.entries(o.votes).map(([s, v]) => `${s}:${v}`).join(", ") || "none read"}`);
        console.log(`  why held: ${o.notes ?? "—"}`);
        console.log(`  opinion: ${o.source_url ?? "—"}`);
      }
      return;
    }
    case "confirm": {
      for (const c of await caseFor(docketArg)) {
        const { data, error } = await db.from("outcomes").select("votes").eq("case_id", c.id).single();
        if (error) throw new Error(`No outcome stored for ${docketArg} yet.`);
        if (Object.keys(data.votes ?? {}).length < 7) throw new Error("The stored guess is missing votes; use `set` to enter the result.");
        await db.from("outcomes").update({ status: "scored", notes: "confirmed by owner" }).eq("case_id", c.id);
        console.log(`${docketArg}: confirmed; ${await scoreCase(db, c.id)} forecast(s) scored.`);
      }
      return;
    }
    case "set": {
      const judgment = arg("judgment");
      const vote: Vote | undefined = judgment === "affirmed" ? "affirm" : judgment === "reversed" ? "reverse" : judgment === "vacated" ? "vacate_remand" : undefined;
      if (!vote) throw new Error("--judgment must be affirmed, reversed or vacated.");
      const against: Vote = vote === "affirm" ? "reverse" : "affirm";
      const majority = list(arg("majority")), dissent = list(arg("dissent")), recused = list(arg("recused"));
      const author = arg("author") ?? null;
      for (const s of [...majority, ...dissent, ...recused, ...(author ? [author] : [])]) if (!SLUGS.has(s)) throw new Error(`Unknown justice "${s}".`);
      const named = [...majority, ...dissent, ...recused];
      if (new Set(named).size !== named.length || named.length !== SLUGS.size) throw new Error("Name every justice exactly once across --majority, --dissent and --recused.");
      if (author && !majority.includes(author)) throw new Error("The author must be in the majority.");
      const votes = Object.fromEntries([...majority.map((s) => [s, vote]), ...dissent.map((s) => [s, against])]);
      const outcome = { affirm: "Affirmed", reverse: "Reversed", vacate_remand: "Vacated and remanded" }[vote as "affirm" | "reverse" | "vacate_remand"];
      for (const c of await caseFor(docketArg)) {
        const { data: existing } = await db.from("outcomes").select("decided_at, source_url").eq("case_id", c.id).maybeSingle();
        const decided = arg("decided") ?? existing?.decided_at;
        if (!decided) throw new Error("No stored decision date; pass --decided YYYY-MM-DD.");
        const { error } = await db.from("outcomes").upsert({ case_id: c.id, decided_at: decided, outcome, votes, author, status: "scored", source_url: existing?.source_url ?? null, notes: "entered by owner" });
        if (error) throw new Error(error.message);
        console.log(`${docketArg}: ${outcome}, ${majority.length}–${dissent.length}; ${await scoreCase(db, c.id)} forecast(s) scored.`);
      }
      return;
    }
    case "run": {
      const term = Number(arg("term") ?? currentTerm());
      const dryRun = process.argv.includes("--dry-run");
      await prodInngest().send({ name: "decisions/read.requested", data: { term, dryRun } });
      console.log(`Sent: read decisions for OT${term}${dryRun ? " (dry run, nothing written)" : ""}. Watch it in the Inngest dashboard (read-decisions).`);
      return;
    }
    default:
      throw new Error("Usage: npm run outcomes -- review | confirm <docket> | set <docket> --judgment … --majority … --dissent … [--author …] [--recused …] [--decided YYYY-MM-DD] | run [--term N] [--dry-run]");
  }
}

main().catch((e) => { console.error((e as Error).message); process.exit(1); });
