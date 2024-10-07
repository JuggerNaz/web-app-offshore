import { InfoIcon } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import {ThemeSwitcher} from "@/components/theme-switcher";

export default async function DashboardPage() {

    const supabase = createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();
  
    return (
        <div className="flex-1 w-full flex flex-col gap-12">
        <div className="flex flex-col gap-2 items-start">``
            <h2 className="font-bold text-2xl mb-4">Your user details</h2>
            <pre className="text-xs font-mono p-3 rounded border max-h-32 overflow-auto">
            {JSON.stringify(user, null, 2)}
            </pre>
        </div>
        switch
        <ThemeSwitcher />
        </div>
    );
}