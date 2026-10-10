import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/predictCase";

// Each Inngest step is one request to this route; a justice agent's step runs 1–2 minutes.
// Vercel Hobby with Fluid compute allows up to 300 s (decisions.md Q26).
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({ client: inngest, functions });
