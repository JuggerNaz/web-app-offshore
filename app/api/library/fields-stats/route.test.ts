import { describe, it, expect, vi } from "vitest";
import { createClient } from "@/utils/supabase/server";
import { GET } from "./route";

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

type Row = Record<string, any>;
type DbResult = { data: Row[] | null; error: any; count?: number };

/**
 * Minimal thenable chainable Supabase query builder mock.
 * `spec` maps table name -> ordered list of results, one per `.from(table)` call.
 */
function makeQuery(result: DbResult) {
  const query: any = {};
  for (const method of ["select", "eq", "or", "in", "order", "range", "limit"]) {
    query[method] = vi.fn().mockReturnValue(query);
  }
  query.maybeSingle = vi.fn().mockResolvedValue(result);
  query.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return query;
}

function makeSupabase(spec: Record<string, DbResult[]>) {
  const calls: { table: string; query: any }[] = [];
  const from = vi.fn((table: string) => {
    const queue = spec[table] ?? [];
    const result = queue.shift() ?? { data: null, error: null };
    const query = makeQuery(result);
    calls.push({ table, query });
    return query;
  });
  return { from, calls };
}

function setupSupabase(spec: Record<string, DbResult[]>) {
  const supabase = makeSupabase(spec);
  vi.mocked(createClient).mockReturnValue(supabase as any);
  return supabase;
}

describe("GET /api/library/fields-stats", () => {
  it("counts platforms and pipelines per field using exactly two light queries", async () => {
    const supabase = setupSupabase({
      u_lib_list: [
        {
          data: [
            { lib_id: 1, lib_desc: "Alpha" },
            { lib_id: 2, lib_desc: "Beta" },
          ],
          error: null,
        },
      ],
      platform: [
        { data: [{ pfield: 1 }, { pfield: 1 }, { pfield: 2 }, { pfield: 9 }], error: null },
      ],
      u_pipeline: [{ data: [{ pfield: 2 }], error: null }],
    });

    const response = await GET();
    const json = await response.json();

    expect(json.data).toEqual([
      { lib_id: 1, lib_desc: "Alpha", platform_count: 2, pipeline_count: 0 },
      { lib_id: 2, lib_desc: "Beta", platform_count: 1, pipeline_count: 1 },
    ]);

    // N+1 regression guard: one pfield-select per table, never per-field count queries.
    expect(supabase.from).toHaveBeenCalledTimes(3);
    const platformCall = supabase.calls.find((c) => c.table === "platform");
    const pipelineCall = supabase.calls.find((c) => c.table === "u_pipeline");
    expect(platformCall).toBeDefined();
    expect(pipelineCall).toBeDefined();
    expect(platformCall!.query.select).toHaveBeenCalledWith("pfield");
    expect(pipelineCall!.query.select).toHaveBeenCalledWith("pfield");

    // Reference data is browser-cached for 300s.
    expect(response.headers.get("Cache-Control")).toBe(
      "private, max-age=300, stale-while-revalidate=600"
    );
  });

  it("returns 500 and skips the count queries when the field list fails", async () => {
    const supabase = setupSupabase({
      u_lib_list: [{ data: null, error: { message: "db down" } }],
    });

    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to fetch fields");
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it("treats null count results as zero without failing", async () => {
    const supabase = setupSupabase({
      u_lib_list: [{ data: [{ lib_id: 1, lib_desc: "Alpha" }], error: null }],
      platform: [{ data: null, error: null }],
      u_pipeline: [{ data: null, error: null }],
    });

    const response = await GET();
    const json = await response.json();

    expect(json.data).toEqual([
      { lib_id: 1, lib_desc: "Alpha", platform_count: 0, pipeline_count: 0 },
    ]);
  });
});
