// Manage invite codes and check the day's budget. Acts on the database in .env.local, which production shares.
//   npm run invite -- new --runs 3 --note "Sam, law school"
//   npm run invite -- list | off CODE | on CODE | runs CODE N | spend
import { env } from "../../lib/env";
import { HOLD_USD } from "../../lib/filing";
import { newCode, parseArgs, type Command } from "../../lib/invite";
import { serviceClient } from "../../lib/supabase";

const db = serviceClient();
const usd = (n: number) => `$${n.toFixed(2)}`;

async function run(cmd: Command) {
  switch (cmd.kind) {
    case "new": {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = newCode();
        const { error } = await db.from("invite_codes").insert({ code, max_runs: cmd.runs, note: cmd.note });
        if (!error) {
          console.log(`${code}  (${cmd.runs} run${cmd.runs === 1 ? "" : "s"}${cmd.note ? `, ${cmd.note}` : ""})`);
          return;
        }
        if (error.code !== "23505") throw new Error(error.message); // 23505: that code exists already; draw another
      }
      throw new Error("Could not find an unused code after 5 tries.");
    }
    case "list": {
      const { data, error } = await db.from("invite_codes").select("code, note, used_runs, max_runs, active, created_at").order("created_at");
      if (error) throw new Error(error.message);
      if (!data.length) return console.log("No invite codes yet. Create one with: npm run invite -- new");
      console.table(data.map((c) => ({
        code: c.code, note: c.note ?? "", runs: `${c.used_runs} of ${c.max_runs}`, on: c.active ? "yes" : "no", created: String(c.created_at).slice(0, 10),
      })));
      return;
    }
    case "on":
    case "off": {
      const { data, error } = await db.from("invite_codes").update({ active: cmd.kind === "on" }).eq("code", cmd.code).select("code");
      if (error) throw new Error(error.message);
      if (!data.length) throw new Error(`There is no invite code ${cmd.code}.`);
      return console.log(`${cmd.code} is ${cmd.kind}.`);
    }
    case "runs": {
      const { data, error } = await db.from("invite_codes").update({ max_runs: cmd.runs }).eq("code", cmd.code).select("code, used_runs");
      if (error) throw new Error(error.message);
      if (!data.length) throw new Error(`There is no invite code ${cmd.code}.`);
      return console.log(`${cmd.code} now allows ${cmd.runs} run${cmd.runs === 1 ? "" : "s"} (${data[0].used_runs} used).`);
    }
    case "spend": {
      const cap = env.dailySpendCapUsd();
      const afterSpend = await db.rpc("filing_budget", { p_cap: cap, p_hold: 0 });
      const room = await db.rpc("filing_budget", { p_cap: cap, p_hold: HOLD_USD });
      const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const flight = await db.from("predictions").select("id", { count: "exact", head: true }).in("status", ["queued", "running"]).gt("created_at", since);
      const err = afterSpend.error ?? room.error ?? flight.error;
      if (err) throw new Error(err.message);
      const inFlight = flight.count ?? 0;
      const left = Number(room.data);
      console.log(`Cap ${usd(cap)} (from .env.local; production reads its own DAILY_SPEND_CAP_USD)`);
      console.log(`Spent today ${usd(cap - Number(afterSpend.data))} · held ${usd(inFlight * HOLD_USD)} for ${inFlight} run${inFlight === 1 ? "" : "s"} in progress · room ${usd(left)}`);
      console.log(left >= HOLD_USD ? "Filing is open." : "Filing is paused until midnight Eastern.");
      return;
    }
  }
}

// parseArgs throws on bad input; starting inside .then routes that to the same message-and-exit path.
Promise.resolve().then(() => run(parseArgs(process.argv.slice(2)))).catch((e) => { console.error((e as Error).message); process.exit(1); });
