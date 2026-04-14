import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; type: string }> }) {
  const { id, type } = await params;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("comment")
    .select("*")
    .eq("structure_id", Number(id))
    .eq("structure_type", type);

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    } else if (error.code === "22P02") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    } else
      return NextResponse.json(
        { error: `Failed to fetch comment for structure id ${id}` },
        { status: 500 }
      );
  }

  // Enrich data with user information
  if (data && data.length > 0) {
    const userIds = Array.from(new Set(data.map((item) => item.user_id).filter(Boolean)));
    console.log('[Comment API] User IDs to fetch:', userIds);

    // Fetch user information using RPC function
    const { data: usersData, error: usersError } = await (supabase.rpc as any)('get_user_info', {
      user_ids: userIds
    });

    console.log('[Comment API] RPC Response:', { usersData, usersError });

    // Create a map of user_id to user name
    const userMap = new Map();
    if (usersData && !usersError && Array.isArray(usersData)) {
      usersData.forEach((user: any) => {
        const userName = user.full_name || user.email || 'Unknown User';
        console.log(`[Comment API] Mapping ${user.id} -> ${userName}`);
        userMap.set(user.id, userName);
      });
    }

    // Enrich comments with user names
    const enrichedData = data.map((comment) => {
      const user_name = comment.user_id ? userMap.get(comment.user_id) || comment.user_id : 'Unknown';
      console.log(`[Comment API] Comment ${comment.id}: user_id=${comment.user_id}, user_name=${user_name}`);
      return {
        ...comment,
        user_name,
      };
    });

    console.log('[Comment API] Returning enriched data');
    return NextResponse.json({ data: enrichedData });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; type: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = createClient();

  const { data, error } = await supabase.from("comment").insert(body).single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    } else if (error.code === "22P02") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    } else
      return NextResponse.json(
        { error: `Failed to post comment for structure id ${id}` },
        { status: 500 }
      );
  }

  return NextResponse.json({ data });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; type: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = createClient();

  // Extract comment id from body for targeted update
  const commentId = body.id;
  if (!commentId) {
    return NextResponse.json(
      { error: "Missing comment id in request body" },
      { status: 400 }
    );
  }

  // Remove id from update payload
  const { id: _, ...updateData } = body;

  const { data, error } = await supabase
    .from("comment")
    .update(updateData)
    .eq("id", commentId)
    .eq("structure_id", Number(id))
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    } else if (error.code === "22P02") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    } else
      return NextResponse.json(
        { error: `Failed to update comment for structure id ${id}` },
        { status: 500 }
      );
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; type: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const supabase = createClient();

  const commentId = body.id;
  if (!commentId) {
    return NextResponse.json(
      { error: "Missing comment id in request body" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("comment")
    .delete()
    .eq("id", commentId)
    .eq("structure_id", Number(id));

  if (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json(
      { error: `Failed to delete comment ${commentId}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
