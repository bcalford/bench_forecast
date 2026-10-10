// Invite codes for the owner's script (scripts/admin/invite.ts): generating them and reading the command line.
import { randomInt } from "node:crypto";
import { CODE_RE, normalizeCode } from "./filing";

// 24 letters and 8 digits; 0, O, 1 and I are left out so codes read aloud cleanly.
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newCode(rand: (max: number) => number = randomInt): string {
  const four = () => Array.from({ length: 4 }, () => CODE_ALPHABET[rand(CODE_ALPHABET.length)]).join("");
  return `BF-${four()}-${four()}`;
}

export type Command =
  | { kind: "new"; runs: number; note: string | null }
  | { kind: "list" }
  | { kind: "spend" }
  | { kind: "on" | "off"; code: string }
  | { kind: "runs"; code: string; runs: number };

export const USAGE = `Usage: npm run invite -- <command>
  new [--runs N] [--note "who it's for"]   create a code (default 3 runs)
  list                                       every code and how much it has been used
  off CODE | on CODE                         turn a code off or back on
  runs CODE N                                change a code's run limit
  spend                                      today's spending against the cap`;

function runsArg(s: string | undefined): number {
  const n = Number(s);
  if (s === undefined || !Number.isInteger(n) || n < 1 || n > 100) {
    throw new Error(`Expected a whole number of runs from 1 to 100, got "${s ?? ""}".\n\n${USAGE}`);
  }
  return n;
}

function codeArg(s: string | undefined): string {
  const code = normalizeCode(s ?? "");
  if (!CODE_RE.test(code)) throw new Error(`"${s ?? ""}" is not an invite code.\n\n${USAGE}`);
  return code;
}

export function parseArgs(argv: string[]): Command {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "new": {
      let runs = 3;
      let note: string | null = null;
      for (let i = 0; i < rest.length; i++) {
        if (rest[i] === "--runs") runs = runsArg(rest[++i]);
        else if (rest[i] === "--note") note = rest[++i]?.trim() || null;
        else throw new Error(`Unknown option "${rest[i]}".\n\n${USAGE}`);
      }
      return { kind: "new", runs, note };
    }
    case "list":
    case "spend":
      return { kind: cmd };
    case "on":
    case "off":
      return { kind: cmd, code: codeArg(rest[0]) };
    case "runs":
      return { kind: "runs", code: codeArg(rest[0]), runs: runsArg(rest[1]) };
    default:
      throw new Error(USAGE);
  }
}
