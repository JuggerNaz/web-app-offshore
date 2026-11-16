import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getUserMembership } from "@/utils/role-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/");
  }

  // Retrieve user membership
  const result = await getUserMembership(supabase, user.id);
  if ("error" in result) {
    return redirect("/dashboard");
  }

  const { membership, userRole, memberships } = result as any;

  const userRoleLower = (userRole?.role || "").toLowerCase().trim();
  const isSuperAdmin =
    membership?.role === "super_admin" ||
    (memberships || []).some((m: any) => m.role === "super_admin") ||
    userRoleLower === "super admin" ||
    userRoleLower === "super_admin" ||
    userRoleLower === "superadmin";

  const isCompanyAdmin =
    isSuperAdmin ||
    membership?.role === "company_admin" ||
    (memberships || []).some((m: any) => m.role === "company_admin") ||
    userRoleLower === "company admin" ||
    userRoleLower === "company_admin" ||
    userRoleLower === "companyadmin" ||
    userRoleLower === "admin" ||
    userRoleLower === "administrator";

  if (!isSuperAdmin && !isCompanyAdmin && !["company_admin", "super_admin"].includes(membership?.role)) {
    return redirect("/dashboard");
  }

  return <>{children}</>;
}
