/** Rows asked for per request; Supabase answers at most 1000 by default. */
const PAGE = 1000;

/**
 * Every row of a query, fetched a page at a time. Supabase caps a single
 * answer (1000 rows by default), so a plain select silently drops the rest.
 * `page` must order the rows so pages don't overlap.
 */
export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) return rows;
    rows.push(...(data as T[]));
    // Keep going until a page comes back empty: the server's cap may be lower than PAGE.
  }
}
