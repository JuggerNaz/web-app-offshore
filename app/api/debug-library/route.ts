import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";

export async function GET(request: NextRequest) {
    const supabase = createClient();

    const { data: masters, error: masterError } = await supabase
        .from("u_lib_mast" as any)
        .select("*");

    const { data: listItems, error: listError } = await supabase
        .from("u_lib_list" as any)
        .select("*")
        .ilike("lib_desc", "%Fender%");

    const { data: components, error: compError } = await supabase
        .from("components")
        .select("*");

    if (masterError || listError || compError) {
        return handleSupabaseError(masterError || listError || compError, "Failed to fetch debug data");
    }

    return apiSuccess({ masters, listItems, components });
}
