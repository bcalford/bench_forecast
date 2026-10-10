// Reads required environment variables once, with a clear error naming what is missing.
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. Copy web/.env.example to web/.env.local and fill it in.`);
  return value;
}

export const DEFAULT_DAILY_CAP_USD = 10;

// Missing or blank → the default. Unreadable or negative → 0, which closes filing rather than lifting the cap.
export function parseCap(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_DAILY_CAP_USD;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  dailySpendCapUsd: () => parseCap(process.env.DAILY_SPEND_CAP_USD),
};
