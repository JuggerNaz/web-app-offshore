"use server";

import { createClient } from "@/utils/supabase/server";
import { QueryResult, QueryData, QueryError } from '@supabase/supabase-js'
import { headers } from "next/headers";

const supabase = createClient();
export const fetchModules = async () => {
    //const supabase = createClient();
    const { data, error } = await supabase.from("module").select("*");
    
    if (error) {
        console.error(error.message);
        return { error: "Failed to fetch modules" };
    }
    return { data };
}

export const fetchModulesWithCategoryAndType = async () => {

    const { data, error } = await supabase.from("module").select(`
        *,
        category:module_category!category_id(
            name
        ),
        type:type!type_id(
            name
        )
    `).eq('type_id', 2) // 2 for Platform
    //TODO: should be able to filter by correct join column

    if (error) {
        console.error(error.message);
        return { error: "Failed to fetch modules" };
    }
    return { data };
}

export const useFetchModules = async (type?: number) => {

    const { data, error } = await supabase.from("module").select(`
        *,
        category:module_category!category_id(
            name
        ),
        type:type!type_id(
            name
        )
    `).eq('type_id', type || 2) // 2 for Platform
    //TODO: should be able to filter by correct join column

    if (error) {
        console.error(error.message);
        return { error: "Failed to fetch modules" };
    }
    return { data };
}

export const useFetchModule = async (id: number) => {
    const { data, error } = await supabase.from("module").select("*").eq("id", id).single();
    console.log(data)
    if (error) {
        console.error(error.message);
        return { error: "Failed to fetch module" };
    }
    return { data };
}
