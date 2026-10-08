// Reads required environment variables once, with a clear error naming what is missing.
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. Copy web/.env.example to web/.env.local and fill it in.`);
  return value;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  dailySpendCapUsd: () => Number(process.env.DAILY_SPEND_CAP_USD ?? 25),
};
