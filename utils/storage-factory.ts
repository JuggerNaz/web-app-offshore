import { createClient, createAdminClient } from "@/utils/supabase/server";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Client as GraphClient } from "@microsoft/microsoft-graph-client";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { google } from "googleapis";
import { Readable } from "stream";
import { v2 as cloudinary } from "cloudinary";
import "isomorphic-fetch";

export interface StorageHandler {
  upload(file: Buffer | File, fileName: string, contentType: string): Promise<{ publicUrl: string; filePath: string }>;
  delete(filePath: string): Promise<void>;
  getSignedUrl(filePath: string, expiresIn?: number): Promise<string>;
  download?(filePath: string): Promise<{ buffer: Buffer; contentType: string } | null>;
}

/**
 * Supabase Storage Implementation
 */
class SupabaseStorageHandler implements StorageHandler {
  async upload(file: Buffer | File, fileName: string, contentType: string) {
    const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = useAdmin ? createAdminClient() : createClient();
    const filePath = `uploads/${fileName}`;

    const { error: uploadError } = await supabase.storage.from("attachments").upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: contentType,
    });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage.from("attachments").getPublicUrl(filePath);
    return { publicUrl, filePath };
  }

  async delete(filePath: string) {
    const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = useAdmin ? createAdminClient() : createClient();
    
    let relativePath = (filePath || "").trim();
    if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
      const parts = relativePath.split("/");
      const bucketIndex = parts.indexOf("attachments");
      if (bucketIndex !== -1 && bucketIndex < parts.length - 1) {
        relativePath = parts.slice(bucketIndex + 1).join("/");
      }
    } else if (relativePath.startsWith("attachments/")) {
      relativePath = relativePath.replace(/^attachments\//, "");
    }
    relativePath = relativePath.replace(/^\/+/, "");

    await supabase.storage.from("attachments").remove([relativePath]);
  }

  async getSignedUrl(filePath: string, expiresIn: number = 3600) {
    const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = useAdmin ? createAdminClient() : createClient();
    
    let relativePath = (filePath || "").trim();
    if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
      const parts = relativePath.split("/");
      const bucketIndex = parts.indexOf("attachments");
      if (bucketIndex !== -1 && bucketIndex < parts.length - 1) {
        relativePath = parts.slice(bucketIndex + 1).join("/");
      } else {
        // If it's already a full external URL, return as is
        return relativePath;
      }
    } else if (relativePath.startsWith("attachments/")) {
      relativePath = relativePath.replace(/^attachments\//, "");
    }
    relativePath = relativePath.replace(/^\/+/, "");

    const { data, error } = await supabase.storage
      .from("attachments")
      .createSignedUrl(relativePath, expiresIn);
    
    if (error || !data?.signedUrl) {
      const { data: pubData } = supabase.storage
        .from("attachments")
        .getPublicUrl(relativePath);
      if (pubData?.publicUrl) return pubData.publicUrl;
      if (error) throw error;
    }
    return data.signedUrl;
  }

  async download(filePath: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const useAdmin = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = useAdmin ? createAdminClient() : createClient();

    let relativePath = (filePath || "").trim();
    let bucket = "attachments";
    if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
      const parts = relativePath.split("/");
      const bucketIndex = parts.indexOf("attachments");
      if (bucketIndex !== -1 && bucketIndex < parts.length - 1) {
        relativePath = parts.slice(bucketIndex + 1).join("/");
      } else {
        const inspIndex = parts.indexOf("inspection-media");
        if (inspIndex !== -1 && inspIndex < parts.length - 1) {
          relativePath = parts.slice(inspIndex + 1).join("/");
          bucket = "inspection-media";
        }
      }
    } else if (relativePath.startsWith("attachments/")) {
      relativePath = relativePath.replace(/^attachments\//, "");
    } else if (relativePath.startsWith("inspection-media/")) {
      relativePath = relativePath.replace(/^inspection-media\//, "");
      bucket = "inspection-media";
    }
    relativePath = relativePath.replace(/^\/+/, "");

    const pathVariations = [
      relativePath,
      relativePath.startsWith("uploads/") ? relativePath.replace(/^uploads\//, "") : `uploads/${relativePath}`
    ].filter(Boolean);

    const bucketVariations = Array.from(new Set([bucket, "attachments", "inspection-media", "company-assets", "public"]));

    for (const b of bucketVariations) {
      for (const p of pathVariations) {
        try {
          const { data, error } = await supabase.storage.from(b).download(p);
          if (!error && data) {
            const arrayBuffer = await data.arrayBuffer();
            return {
              buffer: Buffer.from(arrayBuffer),
              contentType: data.type || "image/jpeg"
            };
          }
        } catch {}
      }
    }
    return null;
  }
}

/**
 * Local Drive Storage Implementation
 */
class LocalStorageHandler implements StorageHandler {
  private basePath: string;

  constructor(config: { basePath: string }) {
    this.basePath = config.basePath || path.join(os.homedir(), "OffshoreAttachments");
  }

  async upload(file: Buffer | File, fileName: string, contentType: string) {
    const filePath = path.join(this.basePath, "uploads", fileName);
    const dir = path.dirname(filePath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    const buffer = file instanceof Buffer ? file : Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    // For local storage, the public URL is a local file path or a specialized route
    // We'll use a virtual path that the app can interpret
    const virtualUrl = `local://${fileName}`;
    return { publicUrl: virtualUrl, filePath: filePath };
  }

  async delete(filePath: string) {
    try {
      await fs.unlink(filePath);
    } catch (err) {
      console.warn("Failed to delete local file:", err);
    }
  }

  async getSignedUrl(filePath: string) {
    // For local storage, we just return the virtual URL or the path
    // The actual serving would happen via a local route
    return `local://${path.basename(filePath)}`;
  }

  async download(filePath: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      let realPath = filePath;
      if (filePath.startsWith("local://")) {
        const filename = filePath.replace("local://", "");
        realPath = path.join(this.basePath, "uploads", filename);
      } else if (!path.isAbsolute(filePath)) {
        realPath = path.join(this.basePath, filePath);
      }
      const buffer = await fs.readFile(realPath);
      const ext = path.extname(realPath).toLowerCase();
      const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".pdf" ? "application/pdf" : "image/jpeg";
      return { buffer, contentType };
    } catch (e: any) {
      console.warn("[LocalStorageHandler] download failed:", e?.message || e);
      return null;
    }
  }
}

/**
 * Google Drive Storage Implementation (Placeholder)
 */
/**
 * Google Drive API Implementation
 */
class GoogleDriveAPIHandler implements StorageHandler {
  private drive: any;
  private folderId: string;

  constructor(config: any) {
    try {
      const saString = String(config.serviceAccount || "").trim();
      if (!saString) throw new Error("Service Account JSON is empty.");

      const creds = typeof config.serviceAccount === 'object' 
        ? config.serviceAccount 
        : JSON.parse(saString);
        
      const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
      
      this.drive = google.drive({ version: 'v3', auth });
      this.folderId = this.extractFolderId(config.googleDriveFolderId || "");
    } catch (err) {
      console.error("[GoogleDriveAPI] Initialization error:", err);
      throw new Error("Failed to initialize Google Drive API. Please check your Service Account JSON and Folder ID.");
    }
  }

  private extractFolderId(urlOrId: string): string {
    if (!urlOrId) return "";
    if (urlOrId.includes("folders/")) {
      return urlOrId.split("folders/")[1].split("?")[0];
    }
    return urlOrId;
  }

  async upload(file: Buffer | File, fileName: string, contentType: string) {
    if (!this.folderId) throw new Error("Google Drive Folder ID is missing.");

    const buffer = file instanceof Buffer ? file : Buffer.from(await file.arrayBuffer());
    
    const fileMetadata = {
      name: fileName,
      parents: [this.folderId],
    };
    
    const media = {
      mimeType: contentType,
      body: Readable.from(buffer),
    };

    const res = await this.drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
      supportsAllDrives: true, // Crucial for Service Accounts
    });

    return { 
      publicUrl: res.data.webViewLink, 
      filePath: res.data.id 
    };
  }

  async delete(filePath: string) {
    try {
      await this.drive.files.delete({ fileId: filePath });
    } catch (err) {
      console.error("[GoogleDriveAPI] Delete error:", err);
    }
  }

  async getSignedUrl(filePath: string) {
    // For Google Drive, we can return the webViewLink or generate a download link
    const res = await this.drive.files.get({
      fileId: filePath,
      fields: 'webViewLink, webContentLink',
    });
    return res.data.webContentLink || res.data.webViewLink;
  }
}

/**
 * Google Drive Storage Implementation
 * Supports both Local Sync (Google Drive for Desktop) and Direct API
 */
class GoogleDriveStorageHandler implements StorageHandler {
  private handler: StorageHandler;

  constructor(config: any) {
    // Determine mode: If serviceAccount exists and looks like a JSON string, use API Mode
    const hasSA = config?.serviceAccount && String(config.serviceAccount).trim().length > 20;
    
    if (hasSA) {
      console.log("[GoogleDrive] Initializing in API Mode");
      this.handler = new GoogleDriveAPIHandler(config);
    } else if (config?.basePath) {
      console.log("[GoogleDrive] Initializing in Local Sync Mode");
      this.handler = new LocalStorageHandler({ basePath: config.basePath });
    } else {
      throw new Error("Google Drive configuration incomplete. Please provide a Local Path or a Service Account JSON in Preferences.");
    }
  }

  async upload(file: Buffer | File, fileName: string, contentType: string) {
    return this.handler.upload(file, fileName, contentType);
  }

  async delete(filePath: string) {
    return this.handler.delete(filePath);
  }

  async getSignedUrl(filePath: string, expiresIn?: number) {
    return this.handler.getSignedUrl(filePath, expiresIn);
  }
}

/**
 * AWS S3 Storage Implementation
 */
class AWSS3StorageHandler implements StorageHandler {
  protected client: S3Client;
  protected bucket: string;
  protected endpoint?: string;
  protected hasCredentials: boolean;

  constructor(config: any = {}) {
    const safeConfig = config || {};
    const accessKeyId = safeConfig.accessKeyId || 
      safeConfig.keyId || 
      safeConfig.b2KeyId || 
      safeConfig.applicationKeyId || 
      process.env.B2_APPLICATION_KEY_ID || 
      process.env.BACKBLAZE_APPLICATION_KEY_ID || 
      process.env.BACKBLAZE_KEY_ID || 
      process.env.AWS_ACCESS_KEY_ID ||
      (safeConfig.endpoint?.includes("backblazeb2.com") || safeConfig.bucket === "web-app-offshore" ? "005c48eb61245cc0000000001" : undefined);

    const secretAccessKey = safeConfig.secretAccessKey || 
      safeConfig.applicationKey || 
      safeConfig.secretKey || 
      safeConfig.b2AppKey || 
      safeConfig.appKey || 
      process.env.B2_APPLICATION_KEY || 
      process.env.BACKBLAZE_APPLICATION_KEY || 
      process.env.BACKBLAZE_KEY || 
      process.env.AWS_SECRET_ACCESS_KEY ||
      (safeConfig.endpoint?.includes("backblazeb2.com") || safeConfig.bucket === "web-app-offshore" ? "K005KdCLsolj0KOyMjUsDiJrQcQYSLE" : undefined);

    this.hasCredentials = Boolean(accessKeyId && secretAccessKey);

    const creds = this.hasCredentials
      ? { accessKeyId: String(accessKeyId).trim(), secretAccessKey: String(secretAccessKey).trim() }
      : undefined;

    this.client = new S3Client({
      region: safeConfig.region || "us-east-1",
      endpoint: safeConfig.endpoint,
      forcePathStyle: !!safeConfig.endpoint, // Needed for many S3-compatible providers
      ...(creds ? { credentials: creds } : {}),
    });
    this.bucket = safeConfig.bucket || process.env.B2_BUCKET_NAME || process.env.AWS_BUCKET_NAME || "web-app-offshore";
    this.endpoint = safeConfig.endpoint;
  }

  async upload(file: Buffer | File, fileName: string, contentType: string) {
    const filePath = `uploads/${fileName}`;
    const buffer = file instanceof Buffer ? file : Buffer.from(await file.arrayBuffer());

    console.log(`[AWSS3StorageHandler] Uploading ${fileName} to bucket ${this.bucket}...`);
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: filePath,
      Body: buffer,
      ContentType: contentType,
    }));
    console.log(`[AWSS3StorageHandler] PutObjectCommand sent successfully.`);

    // Standard public URL or custom endpoint URL
    let publicUrl = "";
    if (this.endpoint) {
        // Use path-style URL for better compatibility with S3-compatible providers like Backblaze
        const urlObj = new URL(this.endpoint);
        publicUrl = `${urlObj.protocol}//${urlObj.host}/${this.bucket}/${filePath}`;
    } else {
        publicUrl = `https://${this.bucket}.s3.${await this.client.config.region()}.amazonaws.com/${filePath}`;
    }
    
    return { publicUrl, filePath: filePath };
  }

  async delete(filePath: string) {
    const { bucket, key } = parseS3Location(filePath, this.bucket);
    console.log(`[AWSS3StorageHandler] Deleting key "${key}" from bucket "${bucket}"`);
    await this.client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
  }

  async download(filePath: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    if (!this.hasCredentials) {
      console.warn(`[${this.constructor.name}] No credentials configured for S3/B2. Skipping download.`);
      return null;
    }

    const { bucket, key } = parseS3Location(filePath, this.bucket);
    const keyCandidates = [key];
    if (!key.startsWith("uploads/")) {
      keyCandidates.push(`uploads/${key}`);
    }

    for (const testKey of keyCandidates) {
      try {
        const command = new GetObjectCommand({
          Bucket: bucket,
          Key: testKey,
        });
        const res = await this.client.send(command);
        if (res.Body) {
          const byteArray = await (res.Body as any).transformToByteArray();
          return {
            buffer: Buffer.from(byteArray),
            contentType: res.ContentType || "image/jpeg",
          };
        }
      } catch (e: any) {
        // try next candidate
      }
    }
    console.warn(`[${this.constructor.name}] download failed for "${filePath}" in bucket "${bucket}" (tried keys: ${keyCandidates.join(", ")})`);
    return null;
  }

  async getSignedUrl(filePath: string, expiresIn: number = 3600) {
    const { bucket, key } = parseS3Location(filePath, this.bucket);

    // If credentials are not present, do NOT invoke AWS presigner which hangs for 4.2 seconds searching IMDS
    if (!this.hasCredentials) {
      console.warn(`[${this.constructor.name}] No credentials configured for S3/B2. Skipping getSignedUrl.`);
      if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
        return filePath;
      }
      if (this.endpoint) {
        const urlObj = new URL(this.endpoint);
        return `${urlObj.protocol}//${urlObj.host}/${bucket}/${key}`;
      }
      return filePath || "";
    }

    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (e: any) {
      console.warn(`[${this.constructor.name}] getSignedUrl failed:`, e?.message || e);
      return filePath || "";
    }
  }
}

function parseS3Location(input: string, defaultBucket: string): { bucket: string; key: string } {
  let clean = (input || "").trim();
  let bucket = defaultBucket || "web-app-offshore";
  let key = clean;

  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    try {
      const url = new URL(clean);
      const pathParts = url.pathname.split("/").filter(Boolean);

      // Virtual-hosted style: <bucket>.s3.<region>.backblazeb2.com or amazonaws.com
      const hostParts = url.hostname.split(".");
      if (hostParts.length > 3 && !url.hostname.startsWith("s3.")) {
        bucket = hostParts[0];
        key = pathParts.join("/");
      } else if (pathParts.length > 1 && pathParts[0] !== "uploads" && pathParts[0] !== "attachments" && pathParts[0] !== "inspection-media") {
        // Path-style: https://s3.<region>.backblazeb2.com/<bucket>/<key>
        bucket = pathParts[0];
        key = pathParts.slice(1).join("/");
      } else {
        key = pathParts.join("/");
      }
    } catch {
      key = clean;
    }
  }

  // Ensure key is properly URL-decoded so literal spaces, pluses, etc. match the S3 Key
  try {
    key = decodeURIComponent(key);
  } catch {}

  if (bucket && key.startsWith(`${bucket}/`)) {
    key = key.slice(bucket.length + 1);
  }
  if (key.startsWith("attachments/")) {
    key = key.slice("attachments/".length);
  }
  if (key.startsWith("inspection-media/")) {
    key = key.slice("inspection-media/".length);
  }
  key = key.replace(/^\/+/, "");

  return { bucket, key };
}

/**
 * Backblaze B2 Storage Implementation (S3 Compatible)
 */
class BackblazeB2StorageHandler extends AWSS3StorageHandler {
  constructor(config: any = {}) {
    const safeConfig = config || {};
    let region = safeConfig.region || process.env.B2_REGION || "us-east-005";
    let endpoint = "";

    // If user pasted the full endpoint (e.g. s3.us-east-005.backblazeb2.com)
    if (region && region.includes("backblazeb2.com")) {
      const cleanEndpoint = region.replace(/^https?:\/\//, "");
      endpoint = `https://${cleanEndpoint}`;
      
      // Extract region part (the part between 's3.' and '.backblazeb2')
      const match = cleanEndpoint.match(/s3\.([^.]+)\./);
      region = match ? match[1] : region.split('.')[1] || "us-east-005";
    } else {
      endpoint = `https://s3.${region || "us-east-005"}.backblazeb2.com`;
    }

    const bucket = safeConfig.bucket || process.env.B2_BUCKET_NAME || "web-app-offshore";

    super({ ...safeConfig, region, endpoint, bucket });
  }
}

/**
 * Cloudinary Storage Implementation
 */
class CloudinaryStorageHandler implements StorageHandler {
  constructor(config: any) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true,
    });
  }

  async upload(file: Buffer | File, fileName: string, contentType: string) {
    const buffer = file instanceof Buffer ? file : Buffer.from(await file.arrayBuffer());
    
    // Cloudinary upload requires base64 or file path
    const base64 = `data:${contentType};base64,${buffer.toString("base64")}`;
    
    const res = await cloudinary.uploader.upload(base64, {
      resource_type: "auto",
      folder: "offshore_attachments",
      public_id: fileName.split(".")[0],
    });

    return { 
      publicUrl: res.secure_url, 
      filePath: res.public_id 
    };
  }

  async delete(filePath: string) {
    try {
      await cloudinary.uploader.destroy(filePath);
    } catch (err) {
      console.error("[Cloudinary] Delete error:", err);
    }
  }

  async getSignedUrl(filePath: string) {
    // Cloudinary uses public IDs. For private images, we can generate a signed URL
    return cloudinary.url(filePath, {
      sign_url: true,
      secure: true,
    });
  }
}

/**
 * OneDrive Storage Implementation
 */
class OneDriveStorageHandler implements StorageHandler {
  private clientId: string;
  private tenantId: string;
  private clientSecret: string;
  private driveId: string;

  constructor(config: any) {
    this.clientId = config.clientId;
    this.tenantId = config.tenantId;
    this.clientSecret = config.clientSecret;
    this.driveId = config.driveId;
  }

  private async getAuthenticatedClient() {
    const msalConfig = {
      auth: {
        clientId: this.clientId,
        authority: `https://login.microsoftonline.com/${this.tenantId}`,
        clientSecret: this.clientSecret,
      },
    };

    const cca = new ConfidentialClientApplication(msalConfig);
    const tokenResponse = await cca.acquireTokenByClientCredential({
      scopes: ["https://graph.microsoft.com/.default"],
    });

    return GraphClient.init({
      authProvider: (done) => {
        done(null, tokenResponse?.accessToken || "");
      },
    });
  }

  async upload(file: Buffer | File, fileName: string, contentType: string) {
    const client = await this.getAuthenticatedClient();
    const filePath = `/uploads/${fileName}`;
    const buffer = file instanceof Buffer ? file : Buffer.from(await file.arrayBuffer());

    const result = await client
      .api(`/drives/${this.driveId}/root:${filePath}:/content`)
      .put(buffer);

    return { publicUrl: result.webUrl, filePath: result.id };
  }

  async delete(filePath: string) {
    try {
      const client = await this.getAuthenticatedClient();
      // If filePath starts with 'http', it might be a webUrl, but Graph API needs Item ID
      // For now we assume filePath stored was result.id
      await client.api(`/drives/${this.driveId}/items/${filePath}`).delete();
    } catch (err) {
      console.warn("Failed to delete OneDrive file:", err);
    }
  }

  async getSignedUrl(filePath: string) {
    const client = await this.getAuthenticatedClient();
    const result = await client
      .api(`/drives/${this.driveId}/items/${filePath}/createLink`)
      .post({ type: 'view' });
    return result.link.webUrl;
  }
}

/**
 * Storage Factory
 */
export async function getStorageHandler(provider: string, config: any): Promise<StorageHandler> {
  const p = (provider || "").toLowerCase().trim();
  console.log(`[StorageFactory] Requested: "${provider}", Normalized: "${p}"`);

  // Robust matching for Google Drive
  if (p === "google drive" || p === "googledrive" || p === "google_drive" || p.includes("google")) {
    return new GoogleDriveStorageHandler(config);
  }

  switch (p) {
    case "local":
    case "local drive":
    case "localdrive":
      return new LocalStorageHandler(config);
    case "aws s3":
    case "awss3":
    case "s3":
      return new AWSS3StorageHandler(config);
    case "backblaze":
    case "backblaze b2":
    case "b2":
      return new BackblazeB2StorageHandler(config);
    case "cloudinary":
      return new CloudinaryStorageHandler(config);
    case "onedrive":
    case "one_drive":
      return new OneDriveStorageHandler(config);
    case "supabase":
    default:
      return new SupabaseStorageHandler();
  }
}

