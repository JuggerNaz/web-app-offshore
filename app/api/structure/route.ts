import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server";

export async function GET() {
    const supabase = createClient();
    const { data: structures, error } = await supabase.from("structure").select("*");

    const platformIds = structures?.filter(item => item.str_type === "PLATFORM").map(item => item.str_id);
    const pipelineIds = structures?.filter(item => item.str_type === "PIPELINE").map(item => item.str_id);

    const { data: platforms } = await supabase.from("platform").select("*").in("plat_id", platformIds || []);
    const { data: pipelines } = await supabase.from("u_pipeline").select("*").in("pipe_id", pipelineIds || []);

    //should return only required fields
    const result = structures?.filter(item => item.str_type == 'PLATFORM' || item.str_type == 'PIPELINE').map(item => {
        const resultObj = {
            str_id: 0,
            str_title: '',
            str_field: '',
            str_type: '',
        }
        if (item.str_type === "PLATFORM") {
            const platform =  platforms?.find(platform => platform.plat_id === item.str_id);
            resultObj.str_id = item.str_id;
            resultObj.str_title = platform?.title!;
            resultObj.str_field = platform?.pfield!;
            resultObj.str_type = item.str_type;
            return resultObj;
        } else if (item.str_type === "PIPELINE") {
            const pipline = pipelines?.find(pipeline => pipeline.pipe_id === item.str_id);
            resultObj.str_id = item.str_id;
            resultObj.str_title = pipline?.title!;
            resultObj.str_field = pipline?.pfield!;
            resultObj.str_type = item.str_type;
            return resultObj;
        }
        return
    })

    if (error) {
        console.error(error.message);
        return NextResponse.json({ error: "Failed to fetch platform" });
    }

    return NextResponse.json({ data: result });
}