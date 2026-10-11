// An Inngest client that always sends to Inngest Cloud, for owner scripts that start production work.
// The app's own client (inngest/client.ts) follows INNGEST_DEV and stays pointed at the local dev server.
import { Inngest } from "inngest";

export function prodInngest() {
  const eventKey = process.env.INNGEST_PROD_EVENT_KEY;
  if (!eventKey) {
    throw new Error("INNGEST_PROD_EVENT_KEY is not set. Add it to web/.env.local (Inngest dashboard → your app's production environment → Event keys) so this runs on production, not the local dev server.");
  }
  return new Inngest({ id: "bench-forecast", eventKey, isDev: false });
}
