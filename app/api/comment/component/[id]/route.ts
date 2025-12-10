import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request, context: any) {
  const { id } = await context.params;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("comment")
    .select("*")
    .eq("component_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    } else if (error.code === "22P02") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    } else
      return NextResponse.json(
        { error: `Failed to fetch comments for component id ${id}` },
        { status: 500 }
      );
  }

  // Enrich data with user information
  if (data && data.length > 0) {
    const userIds = Array.from(new Set(data.map((item) => item.user_id).filter(Boolean)));
    console.log('[Component Comment API] User IDs to fetch:', userIds);
    
    // Fetch user information using RPC function
    const { data: usersData, error: usersError } = await (supabase.rpc as any)('get_user_info', {
      user_ids: userIds
    });
    
    console.log('[Component Comment API] RPC Response:', { usersData, usersError });
    
    // Create a map of user_id to user name
    const userMap = new Map();
    if (usersData && !usersError && Array.isArray(usersData)) {
      usersData.forEach((user: any) => {
        const userName = user.full_name || user.email || 'Unknown User';
        console.log(`[Component Comment API] Mapping ${user.id} -> ${userName}`);
        userMap.set(user.id, userName);
      });
    }

    // Enrich comments with user names
    const enrichedData = data.map((comment) => {
      const user_name = comment.user_id ? userMap.get(comment.user_id) || comment.user_id : 'Unknown';
      console.log(`[Component Comment API] Comment ${comment.id}: user_id=${comment.user_id}, user_name=${user_name}`);
      return {
        ...comment,
        user_name,
      };
    });

    console.log('[Component Comment API] Returning enriched data');
    return NextResponse.json({ data: enrichedData });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request, context: any) {
  const { id } = await context.params;
  const body = await request.json();
  const supabase = createClient();

  const { data, error } = await supabase.from("comment").insert(body).select().single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    } else if (error.code === "22P02") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    } else
      return NextResponse.json(
        { error: `Failed to post comment for component id ${id}` },
        { status: 500 }
      );
  }

  return NextResponse.json({ data });
}
