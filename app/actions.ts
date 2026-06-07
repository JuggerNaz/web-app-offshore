"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
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

  // Intercept and prevent login for deactivated users
  const user = signInData?.user;
  if (user) {
    try {
      const result = await getUserMembership(supabase, user.id);
      if (result && "error" in result) {
        // Programmatically sign out to clear active session cookie
        await supabase.auth.signOut();

        const isDeactivated = result.error === "User profile is inactive" || result.error === "No active company memberships found";
        const errorMsg = isDeactivated
          ? "Your account has been deactivated. Please contact your administrator."
          : `Access Denied: ${result.error}`;

        return encodedRedirect("error", errorRedirect ?? "/sign-in", errorMsg);
      }
    } catch (dbError: any) {
      console.error("Error verifying user status during sign-in:", dbError);
      await supabase.auth.signOut();
      return encodedRedirect("error", errorRedirect ?? "/sign-in", "An error occurred during verification. Please try again.");
    }
  }

  return redirect("/dashboard");
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

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password and confirm password are required"
    );
  }

  if (password !== confirmPassword) {
    encodedRedirect("error", "/protected/reset-password", "Passwords do not match");
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    encodedRedirect("error", "/protected/reset-password", "Password update failed");
  }

  encodedRedirect("success", "/protected/reset-password", "Password updated");
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
