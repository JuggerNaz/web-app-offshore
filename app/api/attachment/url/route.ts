import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { getStorageHandler } from "@/utils/storage-factory";

/**
 * GET /api/attachment/url?id=[id]
 * Generates a temporary signed URL for a private attachment and redirects to it.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing attachment ID" }, { status: 400 });
  }

  // Verify authentication
  const userSupabase = createClient();
  const { data: { user } } = await userSupabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    
    // 1. Fetch attachment record
    const { data: attachment, error: fetchError } = await supabase
      .from("attachment")
      .select("meta, path")
      .eq("id", Number(id))
      .single();

    if (fetchError || !attachment) {
      console.error(`[AttachmentURL] Record not found: ${id}`, fetchError);
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const meta = attachment.meta as any;
    const filePath = meta?.file_path || attachment.path;
    const provider = meta?.storage_provider || "Supabase";

    // 2. Resolve storage handler
    const { data: settings } = await supabase
      .from("company_settings" as any)
      .select("storage_provider, storage_config")
      .eq("id", 1)
      .single() as any;

    // Use the provider from the attachment meta if possible, fallback to current settings
    const activeProvider = provider || settings?.storage_provider || "Supabase";
    const handler = await getStorageHandler(activeProvider, settings?.storage_config);

    // 3. Generate signed URL
    console.log(`[AttachmentURL] Generating signed URL for ID: ${id}, Provider: ${activeProvider}, Path: ${filePath}`);
    const signedUrl = await handler.getSignedUrl(filePath, 3600); // 1 hour expiry

    // 4. Proxy the request to bypass CORS issues
    // Instead of redirecting, we fetch the data server-side and stream it back
    const response = await fetch(signedUrl);
    
    if (!response.ok) {
      throw new Error(`Storage provider returned ${response.status}: ${response.statusText}`);
    }

    // Get the content type from the original response or fallback to octet-stream
    const contentType = response.headers.get("Content-Type") || "application/octet-stream";
    const contentLength = response.headers.get("Content-Length");

    // Stream the response back to the client
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    if (contentLength) headers.set("Content-Length", contentLength);
    headers.set("Cache-Control", "public, max-age=3600"); // Cache for 1 hour

    return new Response(response.body, {
      status: 200,
      headers,
    });
  } catch (err: any) {
    console.error(`[AttachmentURL] Exception:`, err);
    return NextResponse.json({ error: `Failed to resolve attachment URL: ${err.message}` }, { status: 500 });
  }
}
