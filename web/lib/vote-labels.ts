// How each vote is labelled on the bench and in the vote list. On an evenly divided Court there is no
// majority and no dissent: the judgment below stands, so each justice is labelled by the vote they cast.
import type { ClerkTally, JusticeVote } from "./clerk-rules";
import type { SeatVote } from "./court";

export type VoteLabel = Pick<SeatVote, "vote" | "role" | "writes"> & { roleKey: string };

export type VoteLabels = {
  votes: Record<string, VoteLabel>;
  divided: boolean; // evenly divided: no majority, no dissent
  concurring: string[]; // seniority order
  dissenting: string[]; // seniority order
  sideLabels: { majority: string; minority: string }; // names for the filled and hollow seats
};

const ROLE_LABEL: Record<string, string> = {
  majority: "Joins majority",
  concur: "Concurrence",
  concur_judgment: "Concurs in the judgment",
  dissent: "Dissents",
};

const VOTE_LABEL: Record<string, string> = {
  affirm: "Votes to affirm", reverse: "Votes to reverse", vacate_remand: "Votes to vacate", other: "Other disposition",
};

export function labelVotes(rows: Pick<JusticeVote, "justice" | "vote" | "role">[], tally: ClerkTally, author: string | null): VoteLabels {
  const votes: Record<string, VoteLabel> = {};

  if (tally.tie) {
    // The affirming side is drawn filled: its result is the one that stands.
    for (const r of rows) {
      votes[r.justice] = { vote: r.vote === "affirm" ? "majority" : "minority", role: VOTE_LABEL[r.vote] ?? r.vote, writes: false, roleKey: "divided" };
    }
    const setAside = new Set(rows.filter((r) => r.vote !== "affirm" && r.vote !== "other").map((r) => r.vote));
    const minority = setAside.size === 1 ? VOTE_LABEL[[...setAside][0]] : "Votes to set aside";
    return { votes, divided: true, concurring: [], dissenting: [], sideLabels: { majority: "Votes to affirm", minority } };
  }

  const inMajority = new Set(tally.majority);
  for (const r of rows) {
    const majority = inMajority.has(r.justice);
    const isAuthor = r.justice === author;
    const roleKey = majority ? (r.role === "dissent" ? "majority" : r.role) : "dissent";
    votes[r.justice] = {
      vote: majority ? "majority" : "minority",
      role: isAuthor ? "Writes for the Court" : ROLE_LABEL[roleKey] ?? roleKey,
      writes: isAuthor || roleKey === "concur" || roleKey === "concur_judgment",
      roleKey,
    };
  }
  return {
    votes,
    divided: false,
    concurring: tally.sitting.filter((s) => votes[s]?.vote === "majority" && votes[s].writes && s !== author),
    dissenting: tally.sitting.filter((s) => votes[s]?.vote === "minority"),
    sideLabels: { majority: "Majority", minority: "Dissent" },
  };
}
