import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ structure_id: string }> }
) {
    try {
        const { structure_id } = await params;
        const structureIdNum = parseInt(structure_id, 10);

        if (isNaN(structureIdNum)) {
            return NextResponse.json(
                { success: false, error: "Invalid structure ID" },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        const { data, error } = await supabase
            .from("u_obj3d_param" as any)
            .select(
                `str_id, comp_id, elv, str_name, node_no, 
                 s_point3d_x, s_point3d_y, s_point3d_z, 
                 e_point3d_x, e_point3d_y, e_point3d_z, 
                 orient, clk_pos, 
                 tran_vect3d_x, tran_vect3d_y, tran_vect3d_z, 
                 rot_angle_x, rot_angle_y, rot_angle_z, 
                 parent_compid, dist`
            )
            .eq("str_id", structureIdNum);

        if (error) {
            console.error("Error fetching u_obj3d_param:", error);
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: data || [],
        });
    } catch (err: any) {
        console.error("Unexpected error in obj3d-param API:", err);
        return NextResponse.json(
            { success: false, error: err.message || "Internal server error" },
            { status: 500 }
        );
    }
}
