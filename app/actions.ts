"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserMembership } from "@/utils/role-auth";

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const fullName = formData.get("full_name")?.toString();
  const designation = formData.get("designation")?.toString();
  const supabase = createClient();
  const origin = (await headers()).get("origin");

  if (!email || !password) {
    return encodedRedirect("error", "/sign-up", "Email and password are required");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        full_name: fullName || "",
        designation: designation || "",
      },
    },
  });

  if (error) {
    console.error(error.code + " " + error.message);
    return encodedRedirect("error", "/sign-up", error.message);
  } else {
    return encodedRedirect(
      "success",
      "/sign-up",
      "Thanks for signing up! Please check your email for a verification link."
    );
  }
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const errorRedirect = formData.get("errorRedirect") as string;
  const supabase = createClient();

  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return encodedRedirect("error", errorRedirect ?? "/sign-in", error.message);
  }

  // Intercept and prevent login for deactivated users & check tenant count
  const user = signInData?.user;
  if (user) {
    try {
      const result = await getUserMembership(supabase, user.id);
      if (result && "error" in result) {
        // Programmatically sign out to clear active session cookie
        await supabase.auth.signOut();

        const isDeactivated =
          result.error === "User profile is inactive" ||
          result.error === "No active company memberships found";
        const errorMsg = isDeactivated
          ? "Your account is inactive or has no active organization memberships. Please contact your administrator."
          : `Access Denied: ${result.error}`;

        return encodedRedirect("error", errorRedirect ?? "/sign-in", errorMsg);
      }

      const cookieStore = await cookies();

      // Check if user is required to change their temporary password
      if (result.profile?.must_change_password || user.user_metadata?.must_change_password === true) {
        return redirect("/force-change-password");
      }

      // If user has access to multiple active companies, send to /select-tenant
      if (result.memberships && result.memberships.length > 1) {
        return redirect("/select-tenant");
      }

      // Single active tenant: auto-set cookie and proceed to dashboard
      if (result.company?.id) {
        cookieStore.set("active_company_id", result.company.id, {
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
          sameSite: "lax",
        });
      }
    } catch (dbError: any) {
      if (dbError?.digest?.startsWith("NEXT_REDIRECT")) {
        throw dbError;
      }
      console.error("Error verifying user status during sign-in:", dbError);
      await supabase.auth.signOut();
      return encodedRedirect("error", errorRedirect ?? "/sign-in", "An error occurred during verification. Please try again.");
    }
  }

  return redirect("/dashboard");
};

export const selectTenantAction = async (formData: FormData) => {
  const companyId = formData.get("companyId") as string;
  const redirectUrl = (formData.get("redirectUrl") as string) || "/dashboard";
  const supabase = createClient();

  const userRes = await supabase.auth.getUser();
  if (!userRes.data?.user) {
    return redirect("/sign-in");
  }

  if (!companyId) {
    return redirect("/select-tenant");
  }

  // Verify that the user has an active membership in this company
  const { data: membership, error } = await supabase
    .from("company_memberships")
    .select("company_id")
    .eq("user_id", userRes.data.user.id)
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !membership) {
    return encodedRedirect("error", "/select-tenant", "You do not have active access to this organization.");
  }

  const cookieStore = await cookies();
  cookieStore.set("active_company_id", companyId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });

  return redirect(redirectUrl);
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = createClient();
  const origin = (await headers()).get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return encodedRedirect("error", "/forgot-password", "Could not reset password");
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for a link to reset your password."
  );
};

export const forceChangePasswordAction = async (formData: FormData) => {
  const supabase = createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return encodedRedirect(
      "error",
      "/force-change-password",
      "Password and confirm password are required"
    );
  }

  if (password.length < 8) {
    return encodedRedirect(
      "error",
      "/force-change-password",
      "New password must be at least 8 characters long"
    );
  }

  if (password !== confirmPassword) {
    return encodedRedirect(
      "error",
      "/force-change-password",
      "Passwords do not match"
    );
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return encodedRedirect("error", "/sign-in", "Session expired. Please sign in again.");
  }

  // Update password and clear must_change_password in user metadata
  const { error: updateError } = await supabase.auth.updateUser({
    password: password,
    data: {
      must_change_password: false,
    },
  });

  if (updateError) {
    return encodedRedirect("error", "/force-change-password", updateError.message || "Failed to update password");
  }

  // Clear must_change_password in profiles table
  await (supabase as any)
    .from("profiles")
    .update({
      must_change_password: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userData.user.id);

  return redirect("/dashboard");
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    return encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password and confirm password are required"
    );
  }

  if (password.length < 8) {
    return encodedRedirect(
      "error",
      "/protected/reset-password",
      "New password must be at least 8 characters long"
    );
  }

  if (password !== confirmPassword) {
    return encodedRedirect("error", "/protected/reset-password", "Passwords do not match");
  }

  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase.auth.updateUser({
    password: password,
    data: {
      must_change_password: false,
    },
  });

  if (error) {
    return encodedRedirect("error", "/protected/reset-password", "Password update failed: " + error.message);
  }

  if (userData?.user) {
    await (supabase as any)
      .from("profiles")
      .update({
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userData.user.id);
  }

  return encodedRedirect("success", "/protected/reset-password", "Password updated successfully");
};

export const signOutAction = async () => {
  const supabase = createClient();
  await supabase.auth.signOut();
  return redirect("/");
};

export const updateUserProfileAction = async (formData: FormData) => {
  const supabase = createClient();
  
  const fullName = formData.get("full_name")?.toString();
  const designation = formData.get("designation")?.toString();
  const avatarUrl = formData.get("avatar_url")?.toString();

  const { error } = await supabase.auth.updateUser({
    data: {
      full_name: fullName,
      designation: designation,
      avatar_url: avatarUrl,
    },
  });

  if (error) {
    console.error("Profile update failed:", error.message);
    return { error: error.message };
  }

  return { success: true };
};
