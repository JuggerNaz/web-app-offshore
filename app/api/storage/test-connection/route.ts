import { NextResponse } from "next/server";
import { getStorageHandler } from "@/utils/storage-factory";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, storage_config } = body;

    if (!provider || !storage_config) {
      return NextResponse.json({ error: "Provider and storage configuration are required" }, { status: 400 });
    }

    console.log(`[api/storage/test-connection] Testing provider: ${provider}`);

    // Attempt to initialize the handler
    const handler = await getStorageHandler(provider, storage_config);
    
    // Attempt a dummy upload/delete to verify credentials
    const testFile = Buffer.from("Connection Test - " + new Date().toISOString());
    const testFileName = `connection-test-${Date.now()}.txt`;
    
    const { filePath } = await handler.upload(testFile, testFileName, "text/plain");
    
    // Clean up
    await handler.delete(filePath);

    return NextResponse.json({ success: true, message: `Connection to ${provider} successful!` });
  } catch (err: any) {
    console.error(`[api/storage/test-connection] Test failed for ${request.url}:`, err);
    return NextResponse.json({ 
      error: `Connection failed: ${err.message || "Unknown error"}. Please check your credentials and permissions.` 
    }, { status: 500 });
  }
}
