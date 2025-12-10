import { DashboardNav } from "@/components/navigation";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/");
  }
  return (
    <div className="flex-1 w-full flex flex-col overflow-hidden">
      <div className="flex">
        <CollapsibleSidebar />
        <div className="grow">
          <div className="flex flex-col h-screen">
            <DashboardNav />
            <div className="grow flex-col p-5 z-10 overflow-x-hidden overflow-y-scroll">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
