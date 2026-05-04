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

  // Enrich data with source details (Structure, Component, Inspection)
  const enrichedData = await Promise.all(
    (data || []).map(async (attachment) => {
      let enrichment: any = {
        source_name: "Unknown",
        structure_name: null,
        structure_id: null,
        structure_type: null,
        component_name: null,
        component_id: null,
        inspection_name: null,
        inspection_id: null,
      };

      if (attachment.source_id) {
        // Case 1: Platform (Direct Structure)
        if (attachment.source_type === "platform") {
          const { data: platform } = await supabase
            .from("platform")
            .select("title, plat_id")
            .eq("plat_id", attachment.source_id)
            .single();
          if (platform) {
            enrichment.source_name = platform.title;
            enrichment.structure_name = platform.title;
            enrichment.structure_id = platform.plat_id;
            enrichment.structure_type = "Platform";
          }
        }
        // Case 2: Pipeline (Direct Structure)
        else if (attachment.source_type === "pipeline") {
          const { data: pipeline } = await supabase
            .from("u_pipeline")
            .select("title, pipe_id")
            .eq("pipe_id", attachment.source_id)
            .single();
          if (pipeline) {
            enrichment.source_name = pipeline.title;
            enrichment.structure_name = pipeline.title;
            enrichment.structure_id = pipeline.pipe_id;
            enrichment.structure_type = "Pipeline";
          }
        }
        // Case 3: Component (Structure Component)
        else if (attachment.source_type === "component" || attachment.source_type === "structure_component") {
          // Fetch component from structure_components
          const { data: component } = await supabase
            .from("structure_components")
            .select("q_id, id, structure_id")
            .eq("id", attachment.source_id)
            .single();

          if (component) {
            const compName = component.q_id || "Component";
            enrichment.source_name = compName;
            enrichment.component_name = compName;
            enrichment.component_id = component.id;

            // Fetch parent platform using structure_id
            if (component.structure_id) {
              const { data: platform } = await supabase
                .from("platform")
                .select("title, plat_id")
                .eq("plat_id", component.structure_id)
                .single();
              if (platform) {
                enrichment.structure_name = platform.title;
                enrichment.structure_id = platform.plat_id;
                enrichment.structure_type = "Platform";
              }
            }
          }
        }
        // Case 4a: Inspection Record
        else if (attachment.source_type?.toLowerCase() === "inspection") {
          const { data: inspRecord } = await (supabase as any)
            .from("insp_records")
            .select("insp_id, jobpack_id, structure_id, component_id")
            .eq("insp_id", attachment.source_id)
            .single();

          if (inspRecord) {
            let jpName = null;
            let platName = null;
            
            if (inspRecord.jobpack_id) {
              const { data: jp } = await supabase.from("jobpack").select("name").eq("id", inspRecord.jobpack_id).single();
              if (jp) jpName = jp.name;
            }
            if (inspRecord.structure_id) {
              const { data: plat } = await (supabase as any).from("platform").select("title").eq("plat_id", inspRecord.structure_id).single();
              if (plat) {
                platName = plat.title;
                enrichment.structure_name = plat.title;
                enrichment.structure_id = inspRecord.structure_id;
                enrichment.structure_type = "Platform";
              }
            }
            if (inspRecord.component_id) {
              enrichment.component_id = inspRecord.component_id;
              const { data: comp } = await supabase.from("structure_components").select("q_id").eq("id", inspRecord.component_id).single();
              if (comp) {
                enrichment.component_name = comp.q_id;
              }
            }
            
            let sourceStr = "Inspection";
            if (jpName && platName) sourceStr = `${jpName} | ${platName}`;
            else if (jpName) sourceStr = `JP: ${jpName}`;
            else if (platName) sourceStr = `Plat: ${platName}`;

            enrichment.source_name = sourceStr;
            enrichment.inspection_id = inspRecord.insp_id;
          }
        }
        // Case 4b: Inspection Planning
        else if (attachment.source_type === "inspection_planning") {
          const { data: inspection } = await supabase
            .from("inspection_planning")
            .select("name, id, metadata")
            .eq("id", attachment.source_id)
            .single();

          if (inspection) {
            enrichment.source_name = inspection.name;
            enrichment.inspection_name = inspection.name;
            enrichment.inspection_id = inspection.id;

            // Try to extract component/structure info from metadata
            const metadata = inspection.metadata as any;
            if (metadata) {
              // Priority 1: Component info
              if (metadata.componentId) {
                const { data: component } = await supabase
                  .from("components")
                  .select("name, id, plat")
                  .eq("id", metadata.componentId)
                  .single();

                if (component) {
                  enrichment.component_name = component.name;
                  enrichment.component_id = component.id;

                  if (component.plat) {
                    const { data: platform } = await supabase
                      .from("platform")
                      .select("title, plat_id")
                      .eq("plat_id", component.plat)
                      .single();
                    if (platform) {
                      enrichment.structure_name = platform.title;
                      enrichment.structure_id = platform.plat_id;
                      enrichment.structure_type = "Platform";
                    }
                  }
                }
              }
              // Priority 2: Structure info if component is missing
              else if (metadata.structureId) {
                const { data: platform } = await supabase
                  .from("platform")
                  .select("title, plat_id")
                  .eq("plat_id", metadata.structureId)
                  .single();
                if (platform) {
                  enrichment.structure_name = platform.title;
                  enrichment.structure_id = platform.plat_id;
                  enrichment.structure_type = "Platform";
                }
              }
            }
          }
        }
        // Case 5: Jobpack
        else if (attachment.source_type === "jobpack") {
          const { data: jobpack } = await supabase
            .from("jobpack")
            .select("name, id, metadata")
            .eq("id", attachment.source_id)
            .single();
          if (jobpack) {
            enrichment.source_name = jobpack.name;
            enrichment.structure_type = "Work Pack";

            // Try to extract structures from metadata
            const metadata = jobpack.metadata as any;
            if (metadata?.structures && Array.isArray(metadata.structures) && metadata.structures.length > 0) {
              const firstStr = metadata.structures[0];
              enrichment.structure_name = firstStr.title || firstStr.code || firstStr.name || "Multiple Structures";
              enrichment.structure_id = firstStr.id;
            }
          }
        }
        // Case 6: Work Program (workpl)
        else if (attachment.source_type === "workpl" || attachment.source_type === "work_program") {
          const { data: workpl } = await supabase
            .from("workpl")
            .select("jobname, inspno, plantype")
            .eq("inspno", String(attachment.source_id))
            .single();
          if (workpl) {
            enrichment.source_name = workpl.jobname || workpl.inspno;
            enrichment.structure_type = workpl.plantype || "Work Program";
          }
        }
      }
      return { ...attachment, ...enrichment };
    })
  );

  // Create pagination metadata
  const pagination = createPaginationMeta(paginationParams, count || 0);

  return apiPaginated(enrichedData, pagination);
}

export async function POST(request: Request, context: any) {
  const supabase = createClient();
  const formData = await request.formData();

  // Get text fields
  const name = formData.get("name") as string; // more like label
  const source_type = formData.get("source_type") as string;
  const source_id = formData.get("source_id") as string;
  const title = (formData.get("title") as string) || "";
  const description = (formData.get("description") as string) || "";

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
          title: title || name,
          description: description,
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

/**
 * PATCH /api/attachment
 * Update an attachment by ID
 * Body: { id, title, description, ... }
 */
export async function PATCH(request: NextRequest) {
  const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = useAdmin ? createAdminClient() : createClient();
  const body = await request.json();
  const { id, title, description, name } = body;

  if (!id) {
    return NextResponse.json({ error: "No ID provided" }, { status: 400 });
  }

  // Fetch current attachment to get existing meta
  const { data: current, error: fetchError } = await supabase
    .from("attachment")
    .select("meta, name")
    .eq("id", id)
    .single();

  if (fetchError) {
    return handleSupabaseError(fetchError, "Attachment not found");
  }

  const updatedMeta = {
    ...(current.meta as object || {}),
    title: title !== undefined ? title : (current.meta as any)?.title,
    description: description !== undefined ? description : (current.meta as any)?.description,
  };

  const { data, error } = await supabase
    .from("attachment")
    .update({
      name: name || current.name,
      meta: updatedMeta
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return handleSupabaseError(error, "Failed to update attachment");
  }

  return NextResponse.json({ success: true, data });
}

/**
 * PUT /api/attachment
 * Overwrite an existing attachment file
 */
export async function PUT(request: NextRequest) {
  const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = useAdmin ? createAdminClient() : createClient();
  
  try {
    const formData = await request.formData();
    const id = formData.get("id") as string;
    const filePath = formData.get("filePath") as string;
    const file = formData.get("file") as File;

    if (!id || !filePath || !file) {
      return NextResponse.json({ error: "Missing id, filePath, or file" }, { status: 400 });
    }

    const attachmentId = Number(id);

    // Identify relative path of the existing file
    let relativePath = filePath;
    if (filePath.startsWith("http")) {
      const parts = filePath.split("/");
      const bucketIndex = parts.indexOf("attachments");
      if (bucketIndex !== -1 && bucketIndex < parts.length - 1) {
        relativePath = parts.slice(bucketIndex + 1).join("/");
      }
    }

    // Instead of using upsert (which triggers UPDATE RLS on storage.objects that users might not have),
    // we upload the edited image to a NEW path, and then update the database record.
    
    // 1. Attempt to delete the old file (this might fail if they don't have DELETE permissions, but that's okay, we ignore it)
    await supabase.storage.from("attachments").remove([relativePath]);

    // 2. Upload to a new path
    const fileExt = file.name.includes('.') ? file.name.split(".").pop() : "png";
    const newFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}_edited.${fileExt}`;
    const newRelativePath = `uploads/${newFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(newRelativePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("Overwrite storage upload error:", uploadError);
      return NextResponse.json(
        { error: `Failed to upload edited file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // 3. Get the new public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("attachments").getPublicUrl(newRelativePath);

    // 4. Update the database record with the new path and URL
    // First, fetch existing meta to preserve other fields
    const { data: currentAttachment } = await supabase
      .from("attachment")
      .select("meta")
      .eq("id", attachmentId)
      .single();

    const updatedMeta = {
      ...(currentAttachment?.meta as object || {}),
      file_path: newRelativePath,
      file_url: publicUrl,
    };

    const { error: dbError } = await supabase
      .from("attachment")
      .update({
        path: publicUrl,
        meta: updatedMeta
      })
      .eq("id", attachmentId);

    if (dbError) {
      console.error("Failed to update database record after upload:", dbError);
      return handleSupabaseError(dbError, "Failed to update attachment record with new file");
    }

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error("Exception in PUT /api/attachment:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

