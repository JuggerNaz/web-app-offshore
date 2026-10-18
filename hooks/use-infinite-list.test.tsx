import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useInfiniteList } from "./use-infinite-list";

function makeEnvelope(page: number, rows: any[], totalItems: number, hasNextPage: boolean) {
  return {
    success: true,
    data: rows,
    pagination: {
      page,
      pageSize: 50,
      totalItems,
      totalPages: Math.ceil(totalItems / 50),
      hasNextPage,
      hasPreviousPage: page > 1,
    },
  };
}

// Two full pages + one trailing page, mirroring the anomalies-findings view:
// 50-row pages requested with ?page=n&pageSize=50 for a selected structure.
const PAGE1 = [
  { anomaly_id: 1, anomaly_ref_no: "AN-1" },
  { anomaly_id: 2, anomaly_ref_no: "AN-2" },
];
const PAGE2 = [
  { anomaly_id: 3, anomaly_ref_no: "AN-3" },
  { anomaly_id: 4, anomaly_ref_no: "AN-4" },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    const page = Number(new URL(url, "http://localhost").searchParams.get("page") || 1);
    const body =
      page === 1
        ? makeEnvelope(1, PAGE1, 4, true)
        : page === 2
          ? makeEnvelope(2, PAGE2, 4, false)
          : makeEnvelope(3, [], 4, false);
    return { ok: true, json: async () => body } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Wrapper({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function renderList(queryKey: unknown[], enabled = true) {
  return renderHook(
    () =>
      useInfiniteList<any>({
        queryKey,
        getPageUrl: (page) =>
          `/api/anomalies-findings?view=anomalies&structure_id=7&page=${page}&pageSize=50`,
        enabled,
      }),
    { wrapper: Wrapper }
  );
}

describe("useInfiniteList", () => {
  it("loads page 1, accumulates pages via fetchNextPage, and stops at the last page", async () => {
    const { result } = renderList(["anomalies-findings", "anomalies", "7", ""]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual(PAGE1);
    expect(result.current.loadedCount).toBe(2);
    expect(result.current.totalItems).toBe(4);
    expect(result.current.hasNextPage).toBe(true);

    act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
    await waitFor(() => expect(result.current.items).toHaveLength(4));
    expect(result.current.items.map((a) => a.anomaly_id)).toEqual([1, 2, 3, 4]);
    expect(result.current.hasNextPage).toBe(false);

    // Page URLs include the requested 1-based page numbers.
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      expect.stringContaining("page=1"),
      expect.stringContaining("page=2"),
    ]);
  });

  it("does not fetch again once the last page is loaded", async () => {
    const { result } = renderList(["anomalies-findings", "findings", "7", ""]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.items).toHaveLength(4));
    expect(result.current.hasNextPage).toBe(false);

    const callsBefore = fetchMock.mock.calls.length;
    act(() => result.current.fetchNextPage());
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it("updateItem patches the matching row across all loaded pages", async () => {
    const { result } = renderList(["anomalies-findings", "anomalies", "7", "q=none"]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.items).toHaveLength(4));

    // Simulates the view's rectify flow: patch the saved row without refetching.
    // Cache notifications are batched by TanStack's notify manager, so wait
    // for the re-render instead of asserting synchronously.
    act(() =>
      result.current.updateItem((a: any) =>
        a.anomaly_id === 3 ? { ...a, status: "CLOSED" } : a
      )
    );

    await waitFor(() => {
      const updated = result.current.items.find((a) => a.anomaly_id === 3);
      expect(updated).toMatchObject({ anomaly_id: 3, status: "CLOSED" });
    });
    expect(result.current.items.find((a) => a.anomaly_id === 1)?.status).toBeUndefined();
    expect(result.current.items).toHaveLength(4);
  });

  it("does not fetch when disabled", async () => {
    const { result } = renderList(["anomalies-findings", "anomalies", null, ""], false);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("treats an endpoint without pagination meta as a complete single page", async () => {
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ success: true, data: PAGE1 }),
    }) as Response);

    const { result } = renderList(["slim-lookup", "7"]);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual(PAGE1);
    expect(result.current.totalItems).toBeNull();
    expect(result.current.hasNextPage).toBe(false);

    act(() => result.current.fetchNextPage());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the API error message on a failed request", async () => {
    fetchMock.mockImplementation(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: "Failed to fetch anomalies / findings" }),
    }) as Response);

    const { result } = renderList(["anomalies-findings", "anomalies", "7", ""]);

    await waitFor(() => expect(result.current.error).toBe("Failed to fetch anomalies / findings"));
    expect(result.current.items).toEqual([]);
  });
});
