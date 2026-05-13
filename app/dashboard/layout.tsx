import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { GlobalSearch } from "@/components/global-search";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { PresenceProvider } from "@/components/presence-provider";

import { ROVConnectionProvider } from "@/components/rov-connection-provider";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user;
  } catch (error) {
    console.error("Auth error in dashboard layout:", error);
  }

  if (!user) {
    return redirect("/");
  }
  return (
    <div className="app-viewport bg-background">
      <PresenceProvider userId={user.id} userEmail={user.email}>
        <ROVConnectionProvider>
          <GlobalSearch />
          <div className="flex grow overflow-hidden h-full">
            <CollapsibleSidebar />
            <main className="grow flex flex-col min-w-0 bg-slate-50/50 dark:bg-transparent overflow-hidden">
              {children}
            </main>
          </div>
        </ROVConnectionProvider>
      </PresenceProvider>
    </div>
  );
}
