export type KeyOf = (e: any) => string | undefined;

export interface DedupeOpts {
  ttlMs?: number;      // how long to remember IDs
  maxKeys?: number;    // soft cap for memory
  keyOf?: KeyOf;       // how to extract the id from an event
}

export interface Dedupe {
  seen(id: string): boolean;
  checkAndRemember(e: any): boolean;
  size(): number;
}

export function makeMemoryDedupe(opts: DedupeOpts = {}): Dedupe {
  const ttl = Number(process.env.DEDUPE_TTL_MS ?? opts.ttlMs ?? 10 * 60 * 1000);
  const max = Number(process.env.DEDUPE_MAX_KEYS ?? opts.maxKeys ?? 100_000);

  const keyOf: KeyOf =
    opts.keyOf ??
    ((e: any) =>
      e?.id ??
      e?.meta?.id ??
      e?.meta?.headers?.messageId ??
      e?.meta?.corrId);

  const map = new Map<string, number>();

  function gc(now = Date.now()) {
    // TTL cleanup
    for (const [k, exp] of map) {
      if (exp <= now) map.delete(k);
    }
    // Size guard (simple LRU-ish by expiration)
    if (map.size > max) {
      const arr = [...map.entries()].sort((a, b) => a[1] - b[1]); // means oldest first
      const toRemove = map.size - max;
      for (let i = 0; i < toRemove; i++) map.delete(arr[i][0]);
    }
  }

  function remember(id: string) {
    const now = Date.now();
    gc(now);
    map.set(id, now + ttl);
  }

  function seen(id: string): boolean {
    const exp = map.get(id);
    const now = Date.now();
    if (exp && exp > now) return true;
    if (exp) map.delete(id);
    return false;
  }

  return {
    seen,
    checkAndRemember(e: any): boolean {
      const id = typeof e === "string" ? e : keyOf(e);
      if (!id) return true; // nothing to de-dupe on -> treat as new one
      if (seen(id)) return false;
      remember(id);
      return true;
    },
    size() {
      return map.size;
    },
  };
}
