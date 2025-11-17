import { NextResponse } from "next/server";

/**
 * Standard success response wrapper
 * 
 * @param data - The data to return
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with success structure
 */
export function apiSuccess<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

/**
 * Standard error response wrapper
 * 
 * @param message - Error message
 * @param status - HTTP status code (default: 500)
 * @param code - Optional error code
 * @returns NextResponse with error structure
 */
export function apiError(
  message: string,
  status: number = 500,
  code?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(code && { code }),
    },
    { status }
  );
}

/**
 * Response for created resources
 * 
 * @param data - The created resource
 * @returns NextResponse with 201 status
 */
export function apiCreated<T>(data: T): NextResponse {
  return apiSuccess(data, 201);
}

/**
 * Response for no content (typically for DELETE operations)
 * 
 * @returns NextResponse with 204 status
 */
export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * Response for unauthorized access
 * 
 * @param message - Error message (default: "Unauthorized")
 * @returns NextResponse with 401 status
 */
export function apiUnauthorized(message: string = "Unauthorized"): NextResponse {
  return apiError(message, 401, "UNAUTHORIZED");
}

/**
 * Response for forbidden access
 * 
 * @param message - Error message (default: "Forbidden")
 * @returns NextResponse with 403 status
 */
export function apiForbidden(message: string = "Forbidden"): NextResponse {
  return apiError(message, 403, "FORBIDDEN");
}

/**
 * Response for not found resources
 * 
 * @param message - Error message (default: "Not found")
 * @returns NextResponse with 404 status
 */
export function apiNotFound(message: string = "Resource not found"): NextResponse {
  return apiError(message, 404, "NOT_FOUND");
}

/**
 * Response for bad requests
 * 
 * @param message - Error message
 * @returns NextResponse with 400 status
 */
export function apiBadRequest(message: string): NextResponse {
  return apiError(message, 400, "BAD_REQUEST");
}
