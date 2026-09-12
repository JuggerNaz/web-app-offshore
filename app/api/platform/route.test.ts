import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { GET } from "./route";

// Bypass auth: withAuth becomes identity so GET is the raw handler.
vi.mock("@/utils/with-auth", () => ({
  withAuth: (handler: any) => handler,
}));

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

function makeRequest(query = "pageSize=200") {
  return new NextRequest(`http://localhost:3000/api/platform?${query}`);
}

const PLATFORMS = [
  { plat_id: 11, title: "P-A", pfield: 1 },
  { plat_id: 22, title: "P-B", pfield: 2 },
  { plat_id: 33, title: "P-C", pfield: 3 },
];

const FIELDS = [
  { lib_id: 1, lib_desc: "Alpha Field" },
  { lib_id: 3, lib_desc: "Gamma Field" },
];

const IMAGES = [
  { id: "a1", path: "a1.png", meta: { w: 1 }, source_id: 11 },
  { id: "a2", path: "a2.png", meta: null, source_id: 11 },
  { id: "a3", path: "a3.png", meta: null, source_id: 22 },
];

function defaultSpec() {
  return {
    platform: [{ data: PLATFORMS, error: null, count: 3 }],
    u_lib_list: [{ data: FIELDS, error: null }],
    attachment: [{ data: IMAGES, error: null }],
  };
}

describe("GET /api/platform", () => {
  it("fetches all structure images in a single batched query and groups them per platform", async () => {
    const supabase = setupSupabase(defaultSpec());

    const response = await GET(makeRequest(), { params: Promise.resolve({}) });
    const json = await response.json();

    // N+1 regression guard: exactly one attachment query for the whole page,
    // filtered with one `.in()` covering every platform id.
    const attachmentCalls = supabase.calls.filter((c) => c.table === "attachment");
    expect(attachmentCalls).toHaveLength(1);
    expect(attachmentCalls[0].query.eq).toHaveBeenCalledWith(
      "source_type",
      "platform_structure_image"
    );
    expect(attachmentCalls[0].query.in).toHaveBeenCalledWith(
      "source_id",
      [11, 22, 33]
    );

    const [pa, pb, pc] = json.data;
    expect(pa.images).toEqual([
      { id: "a1", path: "a1.png", meta: { w: 1 } },
      { id: "a2", path: "a2.png", meta: null },
    ]);
    expect(pb.images).toEqual([{ id: "a3", path: "a3.png", meta: null }]);
    expect(pc.images).toEqual([]);

    expect(json.success).toBe(true);
    expect(json.pagination).toMatchObject({
      page: 1,
      pageSize: 200,
      totalItems: 3,
      totalPages: 1,
      hasNextPage: false,
    });
  });

  it("resolves field_name from the oil-field list with pfield fallback", async () => {
    setupSupabase(defaultSpec());

    const response = await GET(makeRequest(), { params: Promise.resolve({}) });
    const json = await response.json();

    const byId = new Map<number, any>(json.data.map((p: any) => [p.plat_id, p] as [number, any]));
    expect(byId.get(11).field_name).toBe("Alpha Field"); // resolved via u_lib_list
    expect(byId.get(22).field_name).toBe(2); // not in the field list -> raw pfield
    expect(byId.get(33).field_name).toBe("Gamma Field");
  });

  it("skips the attachment query entirely when the page is empty", async () => {
    const supabase = setupSupabase({
      platform: [{ data: [], error: null, count: 0 }],
      u_lib_list: [{ data: FIELDS, error: null }],
    });

    const response = await GET(makeRequest(), { params: Promise.resolve({}) });
    const json = await response.json();

    expect(json.data).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalledWith("attachment");
    expect(json.pagination.totalItems).toBe(0);
  });

  it("applies the field filter when provided", async () => {
    const supabase = setupSupabase(defaultSpec());

    await GET(makeRequest("pageSize=200&field=1"), {
      params: Promise.resolve({}),
    });

    const platformCall = supabase.calls.find((c) => c.table === "platform");
    expect(platformCall!.query.eq).toHaveBeenCalledWith("pfield", "1");
  });

  it("sets a 60s private browser cache header", async () => {
    setupSupabase(defaultSpec());

    const response = await GET(makeRequest(), { params: Promise.resolve({}) });

    expect(response.headers.get("Cache-Control")).toBe(
      "private, max-age=60, stale-while-revalidate=120"
    );
  });

  it("returns an error response when the platform query fails", async () => {
    setupSupabase({
      platform: [{ data: null, error: { message: "db down", code: "XX000" } }],
    });

    const response = await GET(makeRequest(), { params: Promise.resolve({}) });

    expect(response.status).toBe(500);
  });
});
