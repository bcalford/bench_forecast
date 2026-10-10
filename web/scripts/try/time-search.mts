import { embedQueries } from "../../lib/embedding";
import { serviceClient } from "../../lib/supabase";
const [v] = await embedQueries(["standing and Article III"]);
for (const j of ["jackson", "barrett", "roberts"]) {
  const t = Date.now();
  const { data, error } = await serviceClient().rpc("match_passages", { query_embedding: JSON.stringify(v), for_justice: j, match_count: 5 });
  console.log(j.padEnd(8), error ? `error after ${Date.now() - t} ms: ${error.message}` : `${data.length} results in ${Date.now() - t} ms`);
}
