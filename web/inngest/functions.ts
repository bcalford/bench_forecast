// Every Inngest function the app serves.
import { functions as predict } from "./predictCase";
import { readDecisions } from "./readDecisions";

export const functions = [...predict, readDecisions];
