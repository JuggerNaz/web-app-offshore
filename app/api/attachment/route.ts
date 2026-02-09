import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { getPaginationParams, createPaginationMeta, applyPagination } from "@/utils/pagination";
import { apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";

/**
 * GET /api/attachment
 * Fetch all attachments with pagination
 * Query params: ?page=1&pageSize=50
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const paginationParams = getPaginationParams(request);

  // Build query with count for pagination metadata
  let query = supabase.from("attachment").select("*", { count: "exact" });

  // Apply pagination
  query = applyPagination(query, paginationParams);

  const { data, error, count } = await query;

  if (error) {
    return handleSupabaseError(error, "Failed to fetch attachments");
  }

  // Create pagination metadata
  const pagination = createPaginationMeta(paginationParams, count || 0);

  return apiPaginated(data || [], pagination);
}

export async function POST(request: Request, context: any) {
  const supabase = createClient();
  const formData = await request.formData();

  // Get text fields
  const name = formData.get("name") as string; // more like label
  const source_type = formData.get("source_type") as string;
  const source_id = formData.get("source_id") as string;

  // Get file
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Upload file to Supabase Storage
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { error: uploadError } = await supabase.storage.from("attachments").upload(filePath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return NextResponse.json(
      { error: `Failed to upload file: ${uploadError.message}` },
      { status: 500 }
    );
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("attachments").getPublicUrl(filePath);

  console.log(publicUrl);

  const { data, error } = await supabase
    .from("attachment")
    .insert([
      {
        name: name,
        source_type: source_type,
        source_id: Number(source_id),
        meta: {
          file_label: name,
          original_file_name: file.name,
          file_url: publicUrl,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
        },
        path: publicUrl,
      },
    ])
    .select();

  if (error) {
    console.error("DB insertion error:", error.message);
    return NextResponse.json({ error: "Failed to insert attachment into database" }, { status: 500 });
  }

  return NextResponse.json({ success: true, attachment: data?.[0] });
}

/**
 * DELETE /api/attachment
 * Delete an attachment by ID (and its file from storage)
 * Query params: ?id=123
 */
export async function DELETE(request: NextRequest) {
  const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = useAdmin ? createAdminClient() : createClient();
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "No ID provided" }, { status: 400 });
  }

  let attachmentId: number | null = null;
  try {
    attachmentId = Number(id);
    if (isNaN(attachmentId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    console.log(`[DELETE] Attempting to delete attachment ID: ${attachmentId}`);

    // 1. Fetch attachment to get storage path
    const { data: attachment, error: fetchError } = await supabase
      .from("attachment")
      .select("path, meta")
      .eq("id", attachmentId)
      .single();

    if (fetchError) {
      console.error(`[DELETE] Fetch error for ID ${attachmentId}:`, fetchError);
      return handleSupabaseError(fetchError, "Attachment not found");
    }

    // 2. Delete from storage if path exists
    const storagePath = (attachment.meta as any)?.file_path || attachment.path;

    if (storagePath) {
      let relativePath = storagePath;
      if (storagePath.startsWith("http")) {
        const parts = storagePath.split("/");
        const bucketIndex = parts.indexOf("attachments");
        if (bucketIndex !== -1 && bucketIndex < parts.length - 1) {
          relativePath = parts.slice(bucketIndex + 1).join("/");
        }
      }

      console.log(`[DELETE] Removing from storage: ${relativePath}`);
      const { error: storageError } = await supabase.storage.from("attachments").remove([relativePath]);
      if (storageError) {
        console.error("[DELETE] Storage delete error (non-fatal):", storageError);
      }
    }

    // 3. Delete from database
    const { data: deleteResult, error: deleteError } = await supabase
      .from("attachment")
      .delete()
      .eq("id", attachmentId)
      .select();

    if (deleteError) {
      console.error(`[DELETE] DB delete error for ID ${attachmentId}:`, deleteError);
      return handleSupabaseError(deleteError, "Failed to delete attachment record");
    }

    if (!deleteResult || deleteResult.length === 0) {
      console.warn(`[DELETE] No rows deleted for ID ${attachmentId}. Possible RLS restriction.`);

      const isMissingServiceKey = !process.env.SUPABASE_SERVICE_ROLE_KEY;
      const errorMessage = isMissingServiceKey
        ? "Delete failed. Permission denied (SUPABASE_SERVICE_ROLE_KEY is missing in .env.local)."
        : "Delete failed. You may not have permission to delete this record.";

      return NextResponse.json(
        { error: errorMessage },
        { status: 403 }
      );
    }

    console.log(`[DELETE] Successfully deleted attachment ID: ${attachmentId}`);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`[DELETE] Exception for ID ${attachmentId}:`, err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

