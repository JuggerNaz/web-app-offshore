"use client";

import { useCallback, useMemo } from "react";
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

/**
 * Shape returned by API routes that use `apiPaginated` (utils/api-response.ts).
 * Tolerates routes that omit `pagination` (plain apiSuccess responses) — those
 * are treated as single-page, complete lists.
 */
export interface PaginatedPage<T> {
  success: boolean;
  data?: T[] | null;
  error?: string;
  pagination?: PaginationMetaLike;
}

export interface PaginationMetaLike {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface UseInfiniteListOptions<T> {
  /** Stable query key — include every input that changes the result (search, filters, ids). */
  queryKey: unknown[];
  /** Builds the request URL for a 1-based page number, e.g. (page) => `/api/users?page=${page}&pageSize=50&q=${q}`. */
  getPageUrl: (page: number) => string;
  /** Optional per-request headers (evaluated at fetch time), e.g. { "x-company-id": activeCompanyId }. */
  getHeaders?: () => Record<string, string>;
  /** Set false to disable fetching entirely (e.g. wait for a parent id). */
  enabled?: boolean;
  /** Rows per page. Must match what `getPageUrl` requests. Default 50. */
  pageSize?: number;
}

export interface UseInfiniteListResult<T> {
  /** All rows loaded so far, in page order. */
  items: T[];
  /** Total rows server-side (null when the endpoint does not return pagination meta). */
  totalItems: number | null;
  loadedCount: number;
  isEmpty: boolean;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  error: string | null;
  fetchNextPage: () => void;
  refetch: () => void;
  /**
   * Patch every cached copy of an item (all pages) in place — keeps the list
   * consistent after PATCH/POST without a full refetch.
   */
  updateItem: (updater: (item: T) => T) => void;
  /** Insert an item at the top of the first page (e.g. newly created records). */
  prependItem: (item: T) => void;
}

const DEFAULT_PAGE_SIZE = 50;

/**
 * Scroll-to-load list fetching built on TanStack Query v5 useInfiniteQuery.
 *
 * Works with the `{ success, data, pagination }` envelope produced by
 * `apiPaginated` (see utils/pagination.ts). Pass `page`, `pageSize` and any
 * filters (e.g. `q`) through `getPageUrl`; include the same values in
 * `queryKey` so changing them resets the loaded pages.
 */
export function useInfiniteList<T>(
  options: UseInfiniteListOptions<T>
): UseInfiniteListResult<T> {
  const { queryKey, getPageUrl, getHeaders, enabled = true, pageSize = DEFAULT_PAGE_SIZE } = options;
  const queryClient = useQueryClient();

  const query = useInfiniteQuery<
    PaginatedPage<T>,
    Error,
    InfiniteData<PaginatedPage<T>>,
    unknown[],
    number
  >({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const res = await fetch(getPageUrl(pageParam), {
        headers: getHeaders?.() ?? undefined,
      });
      let json: PaginatedPage<T> | null = null;
      try {
        json = (await res.json()) as PaginatedPage<T>;
      } catch (_) {
        // fall through to !res.ok branch
      }
      if (!res.ok || !json || json.success === false) {
        throw new Error(json?.error || `Request failed (${res.status})`);
      }
      return json;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage?.pagination) {
        return lastPage.pagination.hasNextPage ? lastPageParam + 1 : undefined;
      }
      // No pagination meta => assume the whole list arrived in one page.
      return undefined;
    },
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((p) => p.data ?? []) ?? [],
    [query.data]
  );

  const totalItems = query.data?.pages[0]?.pagination?.totalItems ?? null;

  const updateItem = useCallback(
    (updater: (item: T) => T) => {
      queryClient.setQueryData<InfiniteData<PaginatedPage<T>>>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            data: (page.data ?? []).map((item) => updater(item)),
          })),
        };
      });
    },
    [queryClient, queryKey]
  );

  const prependItem = useCallback(
    (item: T) => {
      queryClient.setQueryData<InfiniteData<PaginatedPage<T>>>(queryKey, (old) => {
        if (!old || old.pages.length === 0) return old;
        const [first, ...rest] = old.pages;
        return {
          ...old,
          pages: [
            { ...first, data: [item, ...(first.data ?? [])] },
            ...rest,
          ],
        };
      });
    },
    [queryClient, queryKey]
  );

  const errorMessage = query.error ? query.error.message : null;

  return {
    items,
    totalItems,
    loadedCount: items.length,
    isEmpty: !query.isLoading && items.length === 0,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: Boolean(query.hasNextPage),
    error: errorMessage,
    fetchNextPage: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) {
        void query.fetchNextPage();
      }
    },
    refetch: () => {
      void query.refetch();
    },
    updateItem,
    prependItem,
  };
}
