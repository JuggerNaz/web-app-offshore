import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { GlobalSearch } from "@/components/global-search";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { PresenceProvider } from "@/components/presence-provider";
import { ROVConnectionProvider } from "@/components/rov-connection-provider";
import { UserProfileProvider } from "@/components/user-profile-provider";
import { getUserMembership } from "@/utils/role-auth";

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

  let initialProfileData: any = undefined;
  try {
    const result = await getUserMembership(supabase, user.id);
    if (result && !("error" in result)) {
      initialProfileData = result;
    }
  } catch (error) {
    console.error("Error pre-fetching profile inside layout:", error);
  }

  return (
    <div className="app-viewport bg-background">
      <UserProfileProvider initialData={initialProfileData}>
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
      </UserProfileProvider>
    </div>
  );
}
