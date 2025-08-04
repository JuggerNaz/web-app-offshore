import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server";

export async function GET() {
    const supabase = createClient();
    const { data, error } = await supabase.from("attachment").select("*");
    
    if (error) {
        console.error(error.message);
        return NextResponse.json({ error: "Failed to fetch attachments" });
    }

    return NextResponse.json({ data })
}

export async function POST(request: Request, context: any) {
    const supabase = createClient();
    const formData = await request.formData()
    
    // Get text fields
    const name = formData.get('name') as string // more like label
    const source_type = formData.get('source_type') as string
    const source_id = formData.get('source_id') as string
    
    // Get file
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Upload file to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`
    const filePath = `uploads/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type
      })

    if (uploadError) throw uploadError

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('attachments')
      .getPublicUrl(filePath)

    
    const { data, error } = await supabase.from("attachment").insert([{
        name: name, //need to change or store filename randomize
        source_type: source_type,
        source_id: Number(source_id),
        meta: {
            file_label: name,
            original_file_name: file.name,
            file_url: publicUrl,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type
        },
        path: publicUrl //more like public url or absolute path
    }]);

    if (error) {
        console.error(error.message);
        return NextResponse.json({ error: "Failed to insert attachment" });
    }

    return NextResponse.json({ attachment: data })
}