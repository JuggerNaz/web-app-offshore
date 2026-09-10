import React from "react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { selectTenantAction, signOutAction } from "@/app/actions";
import { Building2, ArrowRight, ShieldCheck, LogOut, CheckCircle2, UserCheck } from "lucide-react";
import { FormMessage, Message } from "@/components/form-message";
import { cookies } from "next/headers";

export default async function SelectTenantPage({
  searchParams,
}: {
  searchParams: Promise<Message>;
}) {
  const params = await searchParams;
  const supabase = createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return redirect("/sign-in");
  }

  const user = userData.user;

  // Fetch active memberships and company data
  const { data: memberships, error: membershipError } = await (supabase as any)
    .from("company_memberships")
    .select(`
      id,
      role,
      is_active,
      company_id,
      company:companies!company_id(id, name, slug, logo_url)
    `)
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (membershipError || !memberships || memberships.length === 0) {
    await supabase.auth.signOut();
    return redirect("/sign-in?error=" + encodeURIComponent("No active organization memberships found."));
  }

  // If user only has 1 membership, auto-route to dashboard
  if (memberships.length === 1) {
    const singleCompanyId = memberships[0].company_id;
    const cookieStore = await cookies();
    cookieStore.set("active_company_id", singleCompanyId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });
    return redirect("/dashboard");
  }

  // Fetch user profile for avatar/name
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("full_name, designation, email")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.full_name || user.user_metadata?.full_name || user.email;

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-purple-500/15 text-purple-400 border-purple-500/30";
      case "company_admin":
        return "bg-blue-500/15 text-blue-400 border-blue-500/30";
      case "manager":
        return "bg-cyan-500/15 text-cyan-400 border-cyan-500/30";
      case "inspector":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      default:
        return "bg-slate-500/15 text-slate-400 border-slate-500/30";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
          <UserCheck className="h-3.5 w-3.5" />
          <span>Signed in as {displayName}</span>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-white">Select Workspace</h1>
        <p className="text-xs font-medium text-slate-400">
          You have access to multiple organizations. Select a workspace to continue.
        </p>
      </div>

      <FormMessage message={params} />

      {/* Organization Cards List */}
      <div className="flex flex-col gap-3">
        {memberships.map((m: any) => {
          const company = m.company || {};
          const roleFormatted = (m.role || "viewer").replace("_", " ");

          return (
            <form key={m.id} action={selectTenantAction}>
              <input type="hidden" name="companyId" value={m.company_id} />
              <button
                type="submit"
                className="w-full text-left p-4 rounded-2xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-blue-500/50 transition-all duration-200 group flex items-center justify-between shadow-sm hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center shrink-0 text-blue-400 group-hover:scale-105 group-hover:border-blue-500/40 transition-transform">
                    {company.logo_url ? (
                      <img
                        src={company.logo_url}
                        alt={company.name}
                        className="h-7 w-7 object-contain rounded-lg"
                      />
                    ) : (
                      <Building2 className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-white group-hover:text-blue-300 transition-colors truncate">
                      {company.name || "Organization"}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${roleBadgeColor(
                          m.role
                        )}`}
                      >
                        {roleFormatted}
                      </span>
                      {company.slug && (
                        <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                          {company.slug}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="h-8 w-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-blue-600 group-hover:border-blue-500 transition-all ml-2 shrink-0">
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            </form>
          );
        })}
      </div>

      {/* Footer / Sign out option */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
        <span>Need a different account?</span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 text-slate-400 hover:text-red-400 transition-colors font-semibold"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
