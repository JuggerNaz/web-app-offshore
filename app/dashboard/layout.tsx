import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { GlobalSearch } from "@/components/global-search";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { PresenceProvider } from "@/components/presence-provider";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/");
  }
  return (
    <div className="app-viewport bg-background">
      <PresenceProvider userId={user.id} userEmail={user.email}>
        <GlobalSearch />
        <div className="flex grow overflow-hidden h-full">
          <CollapsibleSidebar />
          <main className="grow flex flex-col min-w-0 bg-slate-50/50 dark:bg-transparent overflow-hidden">
            {children}
          </main>
        </div>
      </PresenceProvider>
    </div>
  );
}
