import { NextRequest, NextResponse } from "next/server";
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
import { withTenant } from "@/utils/tenant-auth";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = withTenant(async (request, { companyId }) => {
  const supabase = createClient();
  const paginationParams = getPaginationParams(request);

  let query = (supabase as any).from("attachment").select("*", { count: "exact" }).eq("company_id", companyId);

  query = applyPagination(query, paginationParams);

  const { data, error, count } = await query;

  if (error) {
    return handleSupabaseError(error, "Failed to fetch attachments");
  }

  const enrichedData = await Promise.all(
    (data || []).map(async (attachment: any) => {
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
        if (attachment.source_type === "platform") {
          const { data: platform } = await (supabase as any)
            .from("platform")
            .select("title, plat_id")
            .eq("plat_id", attachment.source_id)
            .eq("company_id", companyId)
            .single();
          if (platform) {
            enrichment.source_name = platform.title;
            enrichment.structure_name = platform.title;
            enrichment.structure_id = platform.plat_id;
            enrichment.structure_type = "Platform";
          }
        }
        else if (attachment.source_type === "pipeline") {
          const { data: pipeline } = await (supabase as any)
            .from("u_pipeline")
            .select("title, pipe_id")
            .eq("pipe_id", attachment.source_id)
            .eq("company_id", companyId)
            .single();
          if (pipeline) {
            enrichment.source_name = pipeline.title;
            enrichment.structure_name = pipeline.title;
            enrichment.structure_id = pipeline.pipe_id;
            enrichment.structure_type = "Pipeline";
          }
        }
        else if (attachment.source_type === "component" || attachment.source_type === "structure_component") {
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

            if (component.structure_id) {
              const { data: platform } = await (supabase as any)
                .from("platform")
                .select("title, plat_id")
                .eq("plat_id", component.structure_id)
                .eq("company_id", companyId)
                .single();
              if (platform) {
                enrichment.structure_name = platform.title;
                enrichment.structure_id = platform.plat_id;
                enrichment.structure_type = "Platform";
              }
            }
          }
        }
        else if (attachment.source_type?.toLowerCase() === "inspection") {
          const { data: inspRecord } = await (supabase as any)
            .from("insp_records")
            .select("insp_id, jobpack_id, structure_id, component_id")
            .eq("insp_id", attachment.source_id)
            .eq("company_id", companyId)
            .single();

          if (inspRecord) {
            let jpName = null;
            let platName = null;
            
            if (inspRecord.jobpack_id) {
              const { data: jp } = await (supabase as any).from("jobpack").select("name").eq("id", inspRecord.jobpack_id).eq("company_id", companyId).single();
              if (jp) jpName = jp.name;
            }
            if (inspRecord.structure_id) {
              const { data: plat } = await (supabase as any).from("platform").select("title").eq("plat_id", inspRecord.structure_id).eq("company_id", companyId).single();
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
        else if (attachment.source_type === "inspection_planning") {
          const { data: inspection } = await (supabase as any)
            .from("inspection_planning")
            .select("name, id, metadata")
            .eq("id", attachment.source_id)
            .eq("company_id", companyId)
            .single();

          if (inspection) {
            enrichment.source_name = inspection.name;
            enrichment.inspection_name = inspection.name;
            enrichment.inspection_id = inspection.id;

            const metadata = inspection.metadata as any;
            if (metadata) {
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
                    const { data: platform } = await (supabase as any)
                      .from("platform")
                      .select("title, plat_id")
                      .eq("plat_id", component.plat)
                      .eq("company_id", companyId)
                      .single();
                    if (platform) {
                      enrichment.structure_name = platform.title;
                      enrichment.structure_id = platform.plat_id;
                      enrichment.structure_type = "Platform";
                    }
                  }
                }
              }
              else if (metadata.structureId) {
                const { data: platform } = await (supabase as any)
                  .from("platform")
                  .select("title, plat_id")
                  .eq("plat_id", metadata.structureId)
                  .eq("company_id", companyId)
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
        else if (attachment.source_type === "jobpack") {
          const { data: jobpack } = await (supabase as any)
            .from("jobpack")
            .select("name, id, metadata")
            .eq("id", attachment.source_id)
            .eq("company_id", companyId)
            .single();
          if (jobpack) {
            enrichment.source_name = jobpack.name;
            enrichment.structure_type = "Work Pack";

            const metadata = jobpack.metadata as any;
            if (metadata?.structures && Array.isArray(metadata.structures) && metadata.structures.length > 0) {
              const firstStr = metadata.structures[0];
              enrichment.structure_name = firstStr.title || firstStr.code || firstStr.name || "Multiple Structures";
              enrichment.structure_id = firstStr.id;
            }
          }
        }
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

  const pagination = createPaginationMeta(paginationParams, count || 0);

  return apiPaginated(enrichedData, pagination);
});

export const POST = withTenant(async (request, { companyId }) => {
  const supabase = createClient();
  
  try {
    const formData = await (request as any).formData();

    const name = formData.get("name") as string;
    const source_type = formData.get("source_type") as string;
    const source_id_str = formData.get("source_id") as string;
    const title = (formData.get("title") as string) || "";
    const description = (formData.get("description") as string) || "";

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

        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(tempInputPath, buffer);

        console.log(`[POST /api/attachment] Running FFmpeg: ${tempInputPath} -> ${tempOutputPath}`);
        const { stdout, stderr } = await execAsync(`ffmpeg -i "${tempInputPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -y "${tempOutputPath}"`);
        
        if (stderr && stderr.includes('Error')) {
            console.warn("[POST /api/attachment] FFmpeg warning/error in stderr:", stderr);
        }

        fileToUpload = await fs.readFile(tempOutputPath);
        finalFileExt = "mp4";
        finalContentType = "video/mp4";
        console.log(`[POST /api/attachment] Transcoding complete. New size: ${fileToUpload instanceof File ? fileToUpload.size : fileToUpload.length}`);
      } catch (transcodeErr: any) {
        console.error("[POST /api/attachment] Transcoding failed critical error:", transcodeErr);
        if (transcodeErr.stderr) {
            console.error("[POST /api/attachment] FFmpeg Stderr:", transcodeErr.stderr);
        }
        fileToUpload = file;
      }
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${finalFileExt}`;
    
    const adminClient = createAdminClient();
    const { data: settings, error: settingsError } = await adminClient
      .from("company_settings" as any)
      .select("storage_provider, storage_config")
      .eq("company_id", companyId)
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

    const { data, error } = await (supabase as any)
      .from("attachment")
      .insert([
        {
          name: name,
          source_type: source_type,
          source_id: source_id,
          company_id: companyId,
          meta: {
            title: title || name,
            description: description,
            file_label: name,
            original_file_name: file.name,
            file_url: publicUrl,
            file_path: storageFilePath,
            file_size: fileToUpload instanceof File ? fileToUpload.size : fileToUpload.length,
            file_type: finalContentType,
            mime: finalContentType,
            size: fileToUpload instanceof File ? fileToUpload.size : fileToUpload.length,
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

    if (tempInputPath) fs.unlink(tempInputPath).catch(() => {});
    if (tempOutputPath) fs.unlink(tempOutputPath).catch(() => {});

    return NextResponse.json({ success: true, attachment: data?.[0] });
  } catch (err: any) {
    console.error("[POST /api/attachment] Exception:", err);
    return NextResponse.json({ error: `Server error during upload: ${err.message || 'Unknown error'}` }, { status: 500 });
  }
});

export const DELETE = withTenant(async (request, { companyId }) => {
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

    const { data: attachment, error: fetchError } = await (supabase as any)
      .from("attachment")
      .select("path, meta")
      .eq("id", attachmentId)
      .eq("company_id", companyId)
      .single();

    if (fetchError) {
      console.error(`[DELETE] Fetch error for ID ${attachmentId}:`, fetchError);
      return handleSupabaseError(fetchError, "Attachment not found");
    }

    const storagePath = (attachment.meta as any)?.file_path || attachment.path;

    if (storagePath) {
      const { data: settings } = await (supabase as any)
        .from("company_settings")
        .select("storage_provider, storage_config")
        .eq("company_id", companyId)
        .single();

      const handler = await getStorageHandler((settings as any)?.storage_provider, (settings as any)?.storage_config);
      console.log(`[DELETE] Using storage provider: ${(settings as any)?.storage_provider || 'Supabase'}`);
      
      try {
        await handler.delete(storagePath);
      } catch (storageError) {
        console.error("[DELETE] Storage delete error (non-fatal):", storageError);
      }
    }

    const { data: deleteResult, error: deleteError } = await (supabase as any)
      .from("attachment")
      .delete()
      .eq("id", attachmentId)
      .eq("company_id", companyId)
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
});

export const PATCH = withTenant(async (request, { companyId }) => {
  const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = useAdmin ? createAdminClient() : createClient();
  const body = await request.json();
  const { id, title, description, name } = body;

  if (!id) {
    return NextResponse.json({ error: "No ID provided" }, { status: 400 });
  }

  const { data: current, error: fetchError } = await (supabase as any)
    .from("attachment")
    .select("meta, name")
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (fetchError) {
    return handleSupabaseError(fetchError, "Attachment not found");
  }

  const updatedMeta = {
    ...(current.meta as object || {}),
    title: title !== undefined ? title : (current.meta as any)?.title,
    description: description !== undefined ? description : (current.meta as any)?.description,
  };

  const { data, error } = await (supabase as any)
    .from("attachment")
    .update({
      name: name || current.name,
      meta: updatedMeta
    })
    .eq("id", id)
    .eq("company_id", companyId)
    .select()
    .single();

  if (error) {
    return handleSupabaseError(error, "Failed to update attachment");
  }

  return NextResponse.json({ success: true, data });
});

export const PUT = withTenant(async (request, { companyId }) => {
  const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = useAdmin ? createAdminClient() : createClient();
  
  try {
    const formData = await (request as any).formData();
    const id = formData.get("id") as string;
    const filePath = formData.get("filePath") as string;
    const file = formData.get("file") as File;

    if (!id || !filePath || !file) {
      return NextResponse.json({ error: "Missing id, filePath, or file" }, { status: 400 });
    }

    const attachmentId = Number(id);

    let relativePath = filePath;
    if (filePath.startsWith("http")) {
      const parts = filePath.split("/");
      const bucketIndex = parts.indexOf("attachments");
      if (bucketIndex !== -1 && bucketIndex < parts.length - 1) {
        relativePath = parts.slice(bucketIndex + 1).join("/");
      }
    }

    const adminClient = createAdminClient();
    const { data: settings } = await adminClient
      .from("company_settings" as any)
      .select("storage_provider, storage_config")
      .eq("company_id", companyId)
      .single() as any;

    const handler = await getStorageHandler(settings?.storage_provider || "Supabase", settings?.storage_config);

    try {
      console.log(`[PUT /api/attachment] Deleting old file: ${relativePath}`);
      await handler.delete(relativePath);
    } catch (err) {
      console.warn(`[PUT /api/attachment] Deletion failed (may be expected):`, err);
    }

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

        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(tempInputPath, buffer);

        console.log(`[PUT /api/attachment] Running FFmpeg: ${tempInputPath} -> ${tempOutputPath}`);
        await execAsync(`ffmpeg -i "${tempInputPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -y "${tempOutputPath}"`);

        fileToUpload = await fs.readFile(tempOutputPath);
        finalFileExt = "mp4";
        finalContentType = "video/mp4";
        console.log(`[PUT /api/attachment] Transcoding complete. New size: ${fileToUpload instanceof File ? fileToUpload.size : fileToUpload.length}`);
      } catch (transcodeErr) {
        console.error("[PUT /api/attachment] Transcoding failed:", transcodeErr);
        fileToUpload = Buffer.from(await file.arrayBuffer());
      }
    } else {
      fileToUpload = Buffer.from(await file.arrayBuffer());
    }

    const newFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}_edited.${finalFileExt}`;
    
    console.log(`[PUT /api/attachment] Uploading edited file to ${settings?.storage_provider || "Supabase"}...`);
    
    const { publicUrl, filePath: storageFilePath } = await handler.upload(fileToUpload, newFileName, finalContentType);

    const { data: currentAttachment } = await (supabase as any)
      .from("attachment")
      .select("meta")
      .eq("id", attachmentId)
      .eq("company_id", companyId)
      .single();

    const updatedMeta = {
      ...((currentAttachment as any)?.meta as object || {}),
      file_path: storageFilePath,
      file_url: publicUrl,
      file_type: finalContentType,
      mime: finalContentType,
      type: finalContentType.startsWith('video/') ? 'VIDEO' : (finalContentType.startsWith('image/') ? 'PHOTO' : 'DOCUMENT'),
    };

    const { error: dbError } = await (supabase as any)
      .from("attachment")
      .update({
        path: publicUrl,
        meta: updatedMeta
      })
      .eq("id", attachmentId)
      .eq("company_id", companyId);

    if (dbError) {
      console.error("Failed to update database record after upload:", dbError);
      return handleSupabaseError(dbError, "Failed to update attachment record with new file");
    }

    if (tempInputPath) fs.unlink(tempInputPath).catch(() => {});
    if (tempOutputPath) fs.unlink(tempOutputPath).catch(() => {});

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error("Exception in PUT /api/attachment:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
});
