import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { withCacheHeaders } from "./api-cache";

describe("withCacheHeaders", () => {
  it("sets private Cache-Control with default stale-while-revalidate of 2x max-age", () => {
    const response = withCacheHeaders(NextResponse.json({ ok: true }), 300);

    expect(response.headers.get("Cache-Control")).toBe(
      "private, max-age=300, stale-while-revalidate=600"
    );
  });

  it("honors an explicit stale-while-revalidate value", () => {
    const response = withCacheHeaders(NextResponse.json({ ok: true }), 60, 30);

    expect(response.headers.get("Cache-Control")).toBe(
      "private, max-age=60, stale-while-revalidate=30"
    );
  });

  it("returns the same response object so it stays chainable", () => {
    const response = NextResponse.json({ ok: true });

    expect(withCacheHeaders(response, 60)).toBe(response);
  });

  it("overwrites any pre-existing Cache-Control header", () => {
    const response = NextResponse.json({ ok: true }, { status: 200 });
    response.headers.set("Cache-Control", "no-store");

    const result = withCacheHeaders(response, 60);

    expect(result.headers.get("Cache-Control")).toBe(
      "private, max-age=60, stale-while-revalidate=120"
    );
  });

  it("does not alter the response body or status", async () => {
    const response = withCacheHeaders(NextResponse.json({ data: [1, 2] }), 60);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [1, 2] });
  });
});
