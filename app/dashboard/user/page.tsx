import {
  Shield,
  Settings,
  Palette,
  Bell,
  Lock,
  Camera,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { signOutAction } from "@/app/actions";
import { ProfileDetails } from "./profile-details";

export default async function UserPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex-1 w-full flex items-center justify-center p-8 bg-slate-50/50">
        <Card className="w-full max-w-md border-none shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8" />
            </div>
            <CardTitle className="text-2xl font-black text-slate-800">Access Denied</CardTitle>
            <CardDescription className="text-slate-500 font-medium mt-2">Please sign in to view and manage your account settings.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 pb-8">
            <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-black" asChild>
              <a href="/sign-in">GO TO SIGN IN</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto space-y-12 overflow-y-auto overflow-x-hidden custom-scrollbar p-6 lg:p-10 bg-white/30">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-10">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
             <div className="w-8 h-2 bg-blue-600 rounded-full" />
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">User Profile Service</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-none">Account Settings</h1>
          <p className="text-lg font-medium text-slate-500 max-w-lg">
            Manage your personal identity, professional designation, and security preferences.
          </p>
        </div>
        <form action={signOutAction} className="shrink-0">
          <Button type="submit" variant="destructive" className="h-12 px-6 font-black shadow-lg shadow-red-100 transition-all hover:scale-105 active:scale-95 uppercase tracking-widest text-[11px]">
            Sign Out Account
          </Button>
        </form>
      </div>

      {/* Profile Details Component - Handles Photo, Name, Designation */}
      <ProfileDetails user={user} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Security Settings */}
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="border-b pb-6">
            <CardTitle className="flex items-center gap-2.5 text-lg font-black text-slate-800">
              <div className="p-1.5 bg-amber-50 text-amber-600 rounded-md">
                <Lock className="w-4 h-4" />
              </div>
              Security & Identity
            </CardTitle>
            <CardDescription className="text-sm font-medium">Manage your password and security gatekeepers</CardDescription>
          </CardHeader>
          <CardContent className="pt-8 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 border border-slate-100 rounded-xl bg-slate-50/50 gap-4 transition-all hover:border-amber-200">
              <div className="space-y-1">
                <p className="font-black text-slate-800 text-sm uppercase tracking-wide">Account Password</p>
                <p className="text-[11px] font-bold text-slate-400">
                  LAST UPDATED {formatDate(user.updated_at || user.created_at).toUpperCase()}
                </p>
              </div>
              <Button variant="outline" size="sm" className="h-10 px-5 font-black text-blue-600 bg-white border-blue-100 hover:bg-blue-50 transition-all" asChild>
                <a href="/protected/reset-password">CHANGE PASSWORD</a>
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 border border-slate-100 rounded-xl bg-slate-50/50 gap-4 transition-all hover:border-slate-200">
              <div className="space-y-1 flex-1">
                <p className="font-black text-slate-800 text-sm uppercase tracking-wide">Two-Factor Auth</p>
                <p className="text-[11px] font-bold text-slate-400">
                  EXTRA LAYER OF ACCOUNT PROTECTION
                </p>
              </div>
              <Badge variant="secondary" className="h-7 px-3 font-black bg-slate-200 text-slate-600 uppercase tracking-widest text-[9px]">
                Not Enabled
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* App Preferences */}
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="border-b pb-6">
            <CardTitle className="flex items-center gap-2.5 text-lg font-black text-slate-800">
              <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md">
                <Settings className="w-4 h-4" />
              </div>
              Application Environment
            </CardTitle>
            <CardDescription className="text-sm font-medium">Customize your visual and notification experience</CardDescription>
          </CardHeader>
          <CardContent className="pt-8 space-y-8">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                  <Palette className="w-4 h-4 text-blue-500" />
                  Interface Theme
                </label>
                <p className="text-[11px] font-bold text-slate-400">
                  CHOOSE YOUR VISUAL COLOR SCHEME
                </p>
              </div>
              <ThemeSwitcher />
            </div>

            <Separator className="opacity-40" />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label className="font-black text-slate-800 text-sm uppercase tracking-wide flex items-center gap-2">
                  <Bell className="w-4 h-4 text-blue-500" />
                  Email Notifications
                </label>
                <p className="text-[11px] font-bold text-slate-400">
                  ALERTS FOR OFFSHORE OPERATIONS
                </p>
              </div>
              <Badge variant="outline" className="h-7 px-3 font-black border-blue-200 text-blue-600 bg-blue-50/50 uppercase tracking-widest text-[9px]">
                Enabled
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Information */}
      <Card className="border-none shadow-sm bg-slate-50/30">
        <CardHeader className="pb-4">
          <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Authentication Context</CardTitle>
        </CardHeader>
        <CardContent>
          <details className="group">
            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-blue-600 transition-colors list-none flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-slate-300" />
              Developer Sandbox
            </summary>
            <pre className="mt-4 text-[10px] font-mono p-5 bg-slate-900 text-white rounded-xl overflow-auto max-h-64 border border-slate-800 shadow-2xl">
              {JSON.stringify(user, null, 2)}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}

