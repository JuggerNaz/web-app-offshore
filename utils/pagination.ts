import { NextRequest } from "next/server";

/**
 * Pagination parameters interface
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
}

/**
 * Pagination metadata interface
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Paginated response interface
 */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Default pagination values
 */
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/**
 * Extract and validate pagination parameters from request URL
 *
 * @param request - NextRequest object
 * @returns Validated pagination parameters
 */
export function getPaginationParams(request: NextRequest): PaginationParams {
  const searchParams = request.nextUrl.searchParams;

  // Parse page number
  let page = parseInt(searchParams.get("page") || String(DEFAULT_PAGE));
  if (isNaN(page) || page < 1) {
    page = DEFAULT_PAGE;
  }

  // Parse page size
  let pageSize = parseInt(
    searchParams.get("pageSize") || searchParams.get("limit") || String(DEFAULT_PAGE_SIZE)
  );
  if (isNaN(pageSize) || pageSize < 1) {
    pageSize = DEFAULT_PAGE_SIZE;
  }
  // Enforce maximum page size
  if (pageSize > MAX_PAGE_SIZE) {
    pageSize = MAX_PAGE_SIZE;
  }

  // Calculate offset
  const offset = (page - 1) * pageSize;

  return { page, pageSize, offset };
}

/**
 * Create pagination metadata
 *
 * @param params - Pagination parameters
 * @param totalItems - Total number of items
 * @returns Pagination metadata
 */
export function createPaginationMeta(params: PaginationParams, totalItems: number): PaginationMeta {
  const totalPages = Math.ceil(totalItems / params.pageSize);

  return {
    page: params.page,
    pageSize: params.pageSize,
    totalItems,
    totalPages,
    hasNextPage: params.page < totalPages,
    hasPreviousPage: params.page > 1,
  };
}

/**
 * Apply pagination to Supabase query
 *
 * Usage example:
 * ```typescript
 * const params = getPaginationParams(request);
 * let query = supabase.from("table").select("*", { count: "exact" });
 * query = applyPagination(query, params);
 * const { data, error, count } = await query;
 * ```
 *
 * @param query - Supabase query builder
 * @param params - Pagination parameters
 * @returns Query builder with pagination applied
 */
export function applyPagination<T>(query: T, params: PaginationParams): T {
  // Apply range for pagination
  // Supabase uses zero-based indexing for range
  const from = params.offset;
  const to = params.offset + params.pageSize - 1;

  return (query as any).range(from, to);
}
