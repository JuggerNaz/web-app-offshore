/**
 * Explicit helper to paginate through all records of a Supabase PostgREST query
 * in batches of `pageSize` (default 1000) to bypass PostgREST's default 1000-row limit.
 */
export async function fetchAllSupabaseRecords<T = any>(
  queryBuilder: any,
  pageSize: number = 1000
): Promise<{ data: T[]; error: any }> {
  let allData: T[] = [];
  let page = 0;
  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await queryBuilder.range(from, to);
    if (error) {
      console.error("[fetchAllSupabaseRecords] Error fetching page", page, error);
      return { data: allData, error };
    }
    if (!data || data.length === 0) {
      break;
    }
    allData.push(...data);
    if (data.length < pageSize) {
      break;
    }
    page++;
    if (page >= 200) {
      console.warn(`[fetchAllSupabaseRecords] Reached safety cap of ${page * pageSize} records.`);
      break;
    }
  }
  return { data: allData, error: null };
}
