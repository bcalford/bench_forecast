import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/predictCase";

// Each Inngest step is one request to this route; a justice agent's step runs 1–2 minutes.
// (Vercel's Hobby plan caps functions at 60 s, so production needs Pro or another host.)
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({ client: inngest, functions });
