import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * GET /api/smart-query/saved
 * List saved query templates for the current user.
 *
 * POST /api/smart-query/saved
 * Create or update a saved query template.
 *
 * DELETE /api/smart-query/saved?id=<uuid>
 * Delete a saved query template.
 *
 * Table: smart_queries (must be created in Supabase)
 *   id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
 *   user_id     UUID NOT NULL REFERENCES auth.users(id)
 *   name        TEXT NOT NULL
 *   description TEXT
 *   config      JSONB NOT NULL  -- full wizard state
 *   created_at  TIMESTAMPTZ DEFAULT now()
 *   updated_at  TIMESTAMPTZ DEFAULT now()
 */

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await (supabase as any)
      .from("smart_queries")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      // Table might not exist yet — return empty list
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        return NextResponse.json({ data: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, description, config } = body;

    if (!name || !config) {
      return NextResponse.json(
        { error: "Name and config are required" },
        { status: 400 }
      );
    }

    // Update existing
    if (id) {
      const { data, error } = await (supabase as any)
        .from("smart_queries")
        .update({
          name,
          description: description || null,
          config,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ data });
    }

    // Create new
    const { data, error } = await (supabase as any)
      .from("smart_queries")
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        config,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Query ID is required" }, { status: 400 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await (supabase as any)
      .from("smart_queries")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
