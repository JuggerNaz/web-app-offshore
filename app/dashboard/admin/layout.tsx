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

  const { membership } = result;

  // Only allow company_admin and super_admin access
  const allowedRoles = ["company_admin", "super_admin"];
  if (!allowedRoles.includes(membership.role)) {
    return redirect("/dashboard");
  }

  return <>{children}</>;
}
