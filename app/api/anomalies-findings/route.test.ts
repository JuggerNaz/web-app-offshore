import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { GET } from "./route";

// Bypass auth: both wrappers become identity so GET is the raw handler.
vi.mock("@/utils/with-auth", () => ({
  withAuth: (handler: any) => handler,
  withOptionalAuth: (handler: any) => handler,
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

type Row = Record<string, any>;
type DbResult = { data: Row[] | Row | null; error: any; count?: number };

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

function makeRequest(query: string) {
  return new NextRequest(`http://localhost:3000/api/anomalies-findings?${query}`);
}

const ANOMALIES = [
  { anomaly_id: 102, anomaly_ref_no: "AN-102" },
  { anomaly_id: 101, anomaly_ref_no: "AN-101" },
];

const FINDINGS = [
  { insp_id: 55, description: "coating breakdown" },
  { insp_id: 54, description: "metal loss" },
];

describe("GET /api/anomalies-findings (items mode)", () => {
  it("returns a paged anomalies window with pagination meta the scroll-to-load hook consumes", async () => {
    const supabase = setupSupabase({
      insp_anomalies: [{ data: ANOMALIES, error: null, count: 102 }],
    });

    const response = await GET(
      makeRequest("view=anomalies&structure_id=7&page=2&pageSize=50"),
      { params: Promise.resolve({}) }
    );
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data).toEqual(ANOMALIES);
    expect(json.pagination).toEqual({
      page: 2,
      pageSize: 50,
      totalItems: 102,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });

    const query = supabase.calls.find((c) => c.table === "insp_anomalies")!.query;
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining("insp_records"), {
      count: "exact",
    });
    // Anomaly rows always join their inspection (inner join).
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining("insp_records!inner"), {
      count: "exact",
    });
    // Scoped to the selected structure (via the joined inspection).
    expect(query.eq).toHaveBeenCalledWith("inspection.structure_id", 7);
    // Deterministic ordering keeps the paged windows stable.
    expect(query.order).toHaveBeenCalledWith("anomaly_id", { ascending: false });
    // Page 2 of 50 -> offset window 50..99.
    expect(query.range).toHaveBeenCalledWith(50, 99);
  });

  it("filters findings to has_anomaly rows", async () => {
    const supabase = setupSupabase({
      insp_records: [{ data: FINDINGS, error: null, count: 60 }],
    });

    const response = await GET(
      makeRequest("view=findings&structure_id=7&page=1&pageSize=50"),
      { params: Promise.resolve({}) }
    );
    const json = await response.json();

    expect(json.data).toEqual(FINDINGS);
    expect(json.pagination).toMatchObject({
      page: 1,
      pageSize: 50,
      totalItems: 60,
      totalPages: 2,
      hasNextPage: true,
    });

    const query = supabase.calls.find((c) => c.table === "insp_records")!.query;
    expect(query.eq).toHaveBeenCalledWith("has_anomaly", true);
    expect(query.or).not.toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith("structure_id", 7);
    expect(query.order).toHaveBeenCalledWith("insp_id", { ascending: false });
    expect(query.range).toHaveBeenCalledWith(0, 49);
  });

  it("applies the ?q= server-side search across the view's searchable columns", async () => {
    const supabase = setupSupabase({
      insp_anomalies: [{ data: ANOMALIES, error: null, count: 2 }],
    });

    await GET(makeRequest("view=anomalies&structure_id=7&q=crack"), {
      params: Promise.resolve({}),
    });

    const query = supabase.calls.find((c) => c.table === "insp_anomalies")!.query;
    // The only .or() is the q search filter across the anomaly search columns.
    expect(query.or).toHaveBeenCalledTimes(1);
    expect(query.or).toHaveBeenCalledWith(
      [
        "anomaly_ref_no.ilike.%crack%",
        "defect_description.ilike.%crack%",
        "defect_type_code.ilike.%crack%",
        "defect_category_code.ilike.%crack%",
      ].join(",")
    );
  });

  it("rejects items requests without a structure_id", async () => {
    setupSupabase({});

    const response = await GET(makeRequest("view=anomalies"), {
      params: Promise.resolve({}),
    });
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.success).toBe(false);
  });

  it("returns an error response when the items query fails", async () => {
    setupSupabase({
      insp_anomalies: [{ data: null, error: { message: "db down", code: "XX000" } }],
    });

    const response = await GET(makeRequest("view=anomalies&structure_id=7"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(500);
  });
});

describe("GET /api/anomalies-findings?mode=counts", () => {
  it("aggregates per-structure anomaly/finding counts", async () => {
    const supabase = setupSupabase({
      insp_anomalies: [
        {
          data: [
            // Every joined anomaly row counts for its structure.
            { insp_records: { structure_id: 7 } },
            { insp_records: { structure_id: 7 } },
            { insp_records: { structure_id: 9 } },
            // Null structure -> ignored entirely.
            { insp_records: { structure_id: null } },
          ],
          error: null,
        },
      ],
      insp_records: [
        {
          data: [
            { structure_id: 7 },
            { structure_id: 7 },
            { structure_id: 9 },
          ],
          error: null,
        },
      ],
    });

    const response = await GET(makeRequest("mode=counts"), {
      params: Promise.resolve({}),
    });
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data).toEqual([
      { structure_id: 7, anomalies: 2, findings: 2 },
      { structure_id: 9, anomalies: 1, findings: 1 },
    ]);

    // Counts are two slim aggregate queries, no pagination/windowing.
    expect(supabase.calls.map((c) => c.table)).toEqual(["insp_anomalies", "insp_records"]);
  });
});

describe("GET /api/anomalies-findings?id= (deep link)", () => {
  it("fetches a single record by primary key without pagination", async () => {
    const supabase = setupSupabase({
      insp_anomalies: [{ data: [ANOMALIES[1]], error: null }],
    });

    const response = await GET(makeRequest("view=anomalies&structure_id=7&id=101"), {
      params: Promise.resolve({}),
    });
    const json = await response.json();

    // Plain apiSuccess envelope (no pagination) — the view treats this as a
    // single deep-linked record, not a scroll-to-load page.
    expect(json.success).toBe(true);
    expect(json.data).toEqual(ANOMALIES[1]);
    expect(json.pagination).toBeUndefined();

    const query = supabase.calls.find((c) => c.table === "insp_anomalies")!.query;
    expect(query.eq).toHaveBeenCalledWith("anomaly_id", 101);
    expect(query.limit).toHaveBeenCalledWith(1);
  });

  it("rejects a non-numeric id", async () => {
    setupSupabase({});

    const response = await GET(makeRequest("view=anomalies&structure_id=7&id=abc"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBe(400);
  });
});
