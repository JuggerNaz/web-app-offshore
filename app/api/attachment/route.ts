import { NextRequest, NextResponse } from "next/server";
// Attachment API - Multi-cloud support enabled
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { getPaginationParams, createPaginationMeta, applyPagination } from "@/utils/pagination";
import { apiPaginated } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { getStorageHandler } from "@/utils/storage-factory";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for large videos

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
  
  try {
    const formData = await request.formData();

    // Get text fields
    const name = formData.get("name") as string;
    const source_type = formData.get("source_type") as string;
    const source_id_str = formData.get("source_id") as string;
    const title = (formData.get("title") as string) || "";
    const description = (formData.get("description") as string) || "";

    // Get file
    const file = formData.get("file") as File;

    console.log(`[POST /api/attachment] Uploading file: ${file?.name}, size: ${file?.size}, type: ${file?.type}`);
    console.log(`[POST /api/attachment] Source Type: ${source_type}, Source ID: ${source_id_str}`);

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const source_id = Number(source_id_str);
    if (isNaN(source_id)) {
      console.error(`[POST /api/attachment] Invalid source_id: ${source_id_str}`);
      return NextResponse.json({ error: `Invalid source_id: ${source_id_str}` }, { status: 400 });
    }

    // Determine if we need to transcode
    const originalFileExt = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const incompatibleFormats = ["wmv", "mkv", "avi", "asf", "flv"];
    const needsTranscoding = incompatibleFormats.includes(originalFileExt?.toLowerCase() || "");

    let fileToUpload: Buffer | File = file;
    let finalFileExt = originalFileExt;
    let finalContentType = file.type;
    let tempInputPath = "";
    let tempOutputPath = "";

    if (needsTranscoding) {
      console.log(`[POST /api/attachment] Incompatible format detected (${originalFileExt}). Starting transcoding...`);
      try {
        const tempDir = os.tmpdir();
        tempInputPath = path.join(tempDir, `input-${Date.now()}.${originalFileExt}`);
        tempOutputPath = path.join(tempDir, `output-${Date.now()}.mp4`);

        // Write input file
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(tempInputPath, buffer);

        // Run FFmpeg
        console.log(`[POST /api/attachment] Running FFmpeg: ${tempInputPath} -> ${tempOutputPath}`);
        // -preset fast for speed, -crf 23 for decent quality/size balance
        const { stdout, stderr } = await execAsync(`ffmpeg -i "${tempInputPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -y "${tempOutputPath}"`);
        
        if (stderr && stderr.includes('Error')) {
            console.warn("[POST /api/attachment] FFmpeg warning/error in stderr:", stderr);
        }

        // Read output file
        fileToUpload = await fs.readFile(tempOutputPath);
        finalFileExt = "mp4";
        finalContentType = "video/mp4";
        console.log(`[POST /api/attachment] Transcoding complete. New size: ${fileToUpload instanceof File ? fileToUpload.size : fileToUpload.length}`);
      } catch (transcodeErr: any) {
        console.error("[POST /api/attachment] Transcoding failed critical error:", transcodeErr);
        if (transcodeErr.stderr) {
            console.error("[POST /api/attachment] FFmpeg Stderr:", transcodeErr.stderr);
        }
        // Fallback to original file
        fileToUpload = file;
      }
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${finalFileExt}`;
    
    // Get storage settings using admin client to bypass RLS
    const adminClient = createAdminClient();
    const { data: settings, error: settingsError } = await adminClient
      .from("company_settings" as any)
      .select("storage_provider, storage_config")
      .eq("id", 1)
      .single() as any;

    if (settingsError || !settings) {
      console.error("[POST /api/attachment] Failed to load company settings:", settingsError);
      return NextResponse.json({ error: "Failed to resolve storage provider configuration. Please check your Preferences." }, { status: 500 });
    }

    console.log(`[POST /api/attachment] DB Settings Provider: "${settings.storage_provider}"`);
    console.log(`[POST /api/attachment] DB Settings Config Keys:`, Object.keys(settings.storage_config || {}));

    const handler = await getStorageHandler(settings.storage_provider, settings.storage_config);
    
    console.log(`[POST /api/attachment] Resolved Handler Class: ${handler.constructor.name}`);

    console.log(`[POST /api/attachment] Starting upload to ${settings.storage_provider}... (Size: ${fileToUpload instanceof File ? fileToUpload.size : fileToUpload.length} bytes, Type: ${finalContentType})`);
    const { publicUrl, filePath: storageFilePath } = await handler.upload(fileToUpload, fileName, finalContentType);
    console.log(`[POST /api/attachment] Upload successful! Provider: ${settings.storage_provider}`);
    console.log(`[POST /api/attachment] Generated Path: ${storageFilePath}`);
    console.log(`[POST /api/attachment] Generated Public URL: ${publicUrl}`);

    const { data, error } = await supabase
      .from("attachment")
      .insert([
        {
          name: name,
          source_type: source_type,
          source_id: source_id,
          meta: {
            title: title || name,
            description: description,
            file_label: name,
            original_file_name: file.name,
            file_url: publicUrl,
            file_path: storageFilePath,
            file_size: fileToUpload instanceof File ? fileToUpload.size : fileToUpload.length,
            file_type: finalContentType,
            mime: finalContentType, // Duplicated for compatibility
            size: fileToUpload instanceof File ? fileToUpload.size : fileToUpload.length, // Duplicated for compatibility
            type: finalContentType.startsWith('video/') ? 'VIDEO' : (finalContentType.startsWith('image/') ? 'PHOTO' : 'DOCUMENT'),
            storage_provider: settings?.storage_provider || 'Supabase'
          },
          path: publicUrl,
        },
      ])
      .select();

    if (error) {
      console.error("[POST /api/attachment] DB insertion error:", error.message);
      return NextResponse.json({ error: `Failed to insert attachment into database: ${error.message}` }, { status: 500 });
    }

    console.log(`[POST /api/attachment] Successfully uploaded and recorded: ${data?.[0]?.id}`);

    // Cleanup temp files
    if (tempInputPath) fs.unlink(tempInputPath).catch(() => {});
    if (tempOutputPath) fs.unlink(tempOutputPath).catch(() => {});

    return NextResponse.json({ success: true, attachment: data?.[0] });
  } catch (err: any) {
    console.error("[POST /api/attachment] Exception:", err);
    return NextResponse.json({ error: `Server error during upload: ${err.message || 'Unknown error'}` }, { status: 500 });
  }
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

    // 2. Delete from storage using handler
    const storagePath = (attachment.meta as any)?.file_path || attachment.path;

    if (storagePath) {
      const { data: settings } = await supabase
        .from("company_settings" as any)
        .select("storage_provider, storage_config")
        .eq("id", 1)
        .single() as any;

      const handler = await getStorageHandler(settings?.storage_provider, settings?.storage_config);
      console.log(`[DELETE] Using storage provider: ${settings?.storage_provider || 'Supabase'}`);
      
      try {
        await handler.delete(storagePath);
      } catch (storageError) {
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
    
    // Get storage settings
    const adminClient = createAdminClient();
    const { data: settings } = await adminClient
      .from("company_settings" as any)
      .select("storage_provider, storage_config")
      .eq("id", 1)
      .single() as any;

    const handler = await getStorageHandler(settings?.storage_provider || "Supabase", settings?.storage_config);

    // 1. Attempt to delete the old file from the current provider
    try {
      console.log(`[PUT /api/attachment] Deleting old file: ${relativePath}`);
      await handler.delete(relativePath);
    } catch (err) {
      console.warn(`[PUT /api/attachment] Deletion failed (may be expected):`, err);
    }

    // 2. Determine if we need to transcode
    const originalFileExt = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const incompatibleFormats = ["wmv", "mkv", "avi", "asf", "flv"];
    const needsTranscoding = incompatibleFormats.includes(originalFileExt?.toLowerCase() || "");

    let fileToUpload: Buffer | File = file;
    let finalFileExt = originalFileExt;
    let finalContentType = file.type;
    let tempInputPath = "";
    let tempOutputPath = "";

    if (needsTranscoding) {
      console.log(`[PUT /api/attachment] Incompatible format detected (${originalFileExt}). Starting transcoding...`);
      try {
        const tempDir = os.tmpdir();
        tempInputPath = path.join(tempDir, `edit-input-${Date.now()}.${originalFileExt}`);
        tempOutputPath = path.join(tempDir, `edit-output-${Date.now()}.mp4`);

        // Write input file
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(tempInputPath, buffer);

        // Run FFmpeg
        console.log(`[PUT /api/attachment] Running FFmpeg: ${tempInputPath} -> ${tempOutputPath}`);
        await execAsync(`ffmpeg -i "${tempInputPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -y "${tempOutputPath}"`);

        // Read output file
        fileToUpload = await fs.readFile(tempOutputPath);
        finalFileExt = "mp4";
        finalContentType = "video/mp4";
        console.log(`[PUT /api/attachment] Transcoding complete. New size: ${fileToUpload instanceof File ? fileToUpload.size : fileToUpload.length}`);
      } catch (transcodeErr) {
        console.error("[PUT /api/attachment] Transcoding failed:", transcodeErr);
        // Fallback to original file
        fileToUpload = Buffer.from(await file.arrayBuffer());
      }
    } else {
      fileToUpload = Buffer.from(await file.arrayBuffer());
    }

    const newFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}_edited.${finalFileExt}`;
    
    console.log(`[PUT /api/attachment] Uploading edited file to ${settings?.storage_provider || "Supabase"}...`);
    
    const { publicUrl, filePath: storageFilePath } = await handler.upload(fileToUpload, newFileName, finalContentType);

    // 4. Update the database record with the new path and URL
    // First, fetch existing meta to preserve other fields
    const { data: currentAttachment } = await supabase
      .from("attachment")
      .select("meta")
      .eq("id", attachmentId)
      .single();

    const updatedMeta = {
      ...(currentAttachment?.meta as object || {}),
      file_path: storageFilePath,
      file_url: publicUrl,
      file_type: finalContentType,
      mime: finalContentType,
      type: finalContentType.startsWith('video/') ? 'VIDEO' : (finalContentType.startsWith('image/') ? 'PHOTO' : 'DOCUMENT'),
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

    // Cleanup temp files
    if (tempInputPath) fs.unlink(tempInputPath).catch(() => {});
    if (tempOutputPath) fs.unlink(tempOutputPath).catch(() => {});

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error("Exception in PUT /api/attachment:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

