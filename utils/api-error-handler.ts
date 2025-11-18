import { NextResponse } from "next/server";
import { PostgrestError } from "@supabase/supabase-js";

/**
 * Maps Supabase/Postgres error codes to HTTP status codes
 */
const ERROR_CODE_MAP: Record<string, number> = {
  PGRST116: 404, // Not found
  "22P02": 400, // Invalid input syntax
  "23505": 409, // Unique violation
  "23503": 409, // Foreign key violation
  "42P01": 500, // Undefined table
};

/**
 * Handles Supabase/Postgres errors and returns appropriate NextResponse
 *
 * @param error - The error object from Supabase
 * @param defaultMessage - Fallback error message
 * @param defaultStatus - Default HTTP status code (default: 500)
 * @returns NextResponse with error details
 */
export function handleSupabaseError(
  error: PostgrestError | any,
  defaultMessage: string = "An error occurred",
  defaultStatus: number = 500
): NextResponse {
  const statusCode = error.code ? ERROR_CODE_MAP[error.code] || defaultStatus : defaultStatus;
  const errorMessage = error.message || defaultMessage;

  // Log error for debugging (consider using a proper logger in production)
  console.error(`[API Error ${statusCode}]:`, {
    code: error.code,
    message: errorMessage,
    details: error.details,
    hint: error.hint,
  });

  return NextResponse.json(
    {
      success: false,
      error: errorMessage,
      code: error.code,
    },
    { status: statusCode }
  );
}

/**
 * Custom API error class for application-specific errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Handles custom ApiError instances
 */
export function handleApiError(error: ApiError): NextResponse {
  console.error(`[API Error ${error.statusCode}]:`, {
    message: error.message,
    code: error.code,
  });

  return NextResponse.json(
    {
      success: false,
      error: error.message,
      code: error.code,
    },
    { status: error.statusCode }
  );
}
