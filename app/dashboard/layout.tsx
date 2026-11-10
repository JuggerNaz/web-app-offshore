import { CollapsibleSidebar } from "@/components/collapsible-sidebar";
import { GlobalSearch } from "@/components/global-search";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { PresenceProvider } from "@/components/presence-provider";
import { ROVConnectionProvider } from "@/components/rov-connection-provider";
import { UserProfileProvider } from "@/components/user-profile-provider";
import { getUserMembership } from "@/utils/role-auth";

import { cookies } from "next/headers";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  let user: any = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user;
  } catch (error) {
    console.error("Auth error in dashboard layout:", error);
  }

  if (!user) {
    return redirect("/sign-in");
  }

  let initialProfileData: any = undefined;
  let deactivationError: string | null = null;

  try {
    const cookieStore = await cookies();
    const activeCompanyId = cookieStore.get("active_company_id")?.value;
    let result = await getUserMembership(supabase, user.id, activeCompanyId);

    // If query failed with activeCompanyId, retry without activeCompanyId to fall back to the first active membership
    if (result && "error" in result && activeCompanyId) {
      const fallbackResult = await getUserMembership(supabase, user.id);
      if (fallbackResult && !("error" in fallbackResult)) {
        result = fallbackResult;
        const comp = Array.isArray((result as any).company) ? (result as any).company[0] : (result as any).company;
        if (comp?.id) {
          cookieStore.set("active_company_id", comp.id, {
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
            sameSite: "lax",
          });
        }
      }
    }

    if (result) {
      if ("error" in result) {
        deactivationError = result.error;
      } else {
        const rawComp = (result as any).company;
        const normalizedComp = Array.isArray(rawComp) ? rawComp[0] : rawComp;
        (result as any).company = normalizedComp;
        initialProfileData = result;

        if (normalizedComp?.id && (!activeCompanyId || activeCompanyId !== normalizedComp.id)) {
          cookieStore.set("active_company_id", normalizedComp.id, {
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
            sameSite: "lax",
          });
        }
      }
    }
  } catch (error) {
    console.error("Error pre-fetching profile inside layout:", error);
  }

  if (deactivationError) {
    return redirect(`/select-tenant?error=${encodeURIComponent(deactivationError)}`);
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
