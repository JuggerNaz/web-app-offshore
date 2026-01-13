import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { apiSuccess } from "@/utils/api-response";
import { handleSupabaseError } from "@/utils/api-error-handler";

export async function GET(request: NextRequest) {
    const supabase = createClient();

    const { data, error } = await supabase
        .from("u_lib_mast" as any)
        .select("*")
        .order("lib_name");

    if (error) {
        return handleSupabaseError(error, "Failed to fetch library master");
    }

    const visibleData = data?.filter((item: any) => item.hidden_item !== 'Y' && item.hidden_item !== 'y');

    return apiSuccess(visibleData);
}
