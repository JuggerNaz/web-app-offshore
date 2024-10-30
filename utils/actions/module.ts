"use server";

import { createClient } from "@/utils/supabase/server";
import { QueryResult, QueryData, QueryError } from '@supabase/supabase-js'

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

const modulesWithCategoryAndType = supabase.from("module").select(`
    *,
    category:module_category!category_id(
        name
    ),
    type:type!type_id(
        name
    )
`);

export type ModulesWithCategoryAndType = QueryData<typeof modulesWithCategoryAndType>

export const fetchModulesWithCategoryAndType = async () => {
    

    
    const { data, error } = await modulesWithCategoryAndType

    console.log(data)

    if (error) {
        console.error(error.message);
        return { error: "Failed to fetch modules" };
    }
    return { data };
}
