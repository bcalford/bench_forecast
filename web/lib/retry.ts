// Retries a call that failed for a transient reason (dropped connection, timeout, 5xx), with backoff.
// Long ingest runs make thousands of calls; one blip should cost a pause, not the run.
export async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 6): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const err = e as Error & { cause?: { code?: string; message?: string } };
      const msg = `${err.message ?? String(e)} ${err.cause?.code ?? ""} ${err.cause?.message ?? ""}`;
      // Includes a connection dropped mid-response ("terminated", cause ECONNRESET) and aborted reads.
      const transient = /fetch failed|terminated|aborted|ETIMEDOUT|ECONNRESET|EPIPE|EAI_AGAIN|UND_ERR|socket|network|timeout|canceling statement|5\d\d|502|503|504/i.test(msg);
      if (!transient || i >= attempts - 1) throw e;
      const wait = Math.min(60, 2 ** i * 3);
      console.warn(`  ${label}: ${msg.slice(0, 80)}; retrying in ${wait}s`);
      await new Promise((r) => setTimeout(r, wait * 1000));
    }
  }
}

// Supabase returns errors instead of throwing; this turns them into throws so withRetry can see them.
export async function ok<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}
