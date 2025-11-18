import {
  User as UserIcon,
  Mail,
  Calendar,
  Shield,
  Settings,
  Palette,
  Key,
  Globe,
  Bell,
  Lock,
  Edit3,
  Camera,
  Save,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import { signOutAction } from "@/app/actions";

export default async function UserPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="flex-1 w-full flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Please sign in to view user settings.</CardDescription>
          </CardHeader>
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

  const getInitials = (email: string) => {
    if (!email) return "U";
    const parts = email.split("@")[0].split(".");
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex-1 w-full max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src="/placeholder-user.jpg" alt="Profile" />
                  <AvatarFallback className="text-lg font-semibold bg-primary/10">
                    {getInitials(user.email || "U")}
                  </AvatarFallback>
                </Avatar>
              </div>
              <CardTitle className="text-xl">{user.email}</CardTitle>
              <CardDescription>
                <Badge variant="secondary" className="mt-2">
                  <Shield className="w-3 h-3 mr-1" />
                  Verified User
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" variant="outline">
                <Camera className="w-4 h-4 mr-2" />
                Update Photo
              </Button>
              <form action={signOutAction}>
                <Button type="submit" variant="destructive" className="w-full">
                  Sign Out
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="w-5 h-5" />
                Account Information
              </CardTitle>
              <CardDescription>Your account details and authentication information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Address
                  </label>
                  <p className="text-muted-foreground bg-muted px-3 py-2 rounded-md">
                    {user.email}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    User ID
                  </label>
                  <p className="text-muted-foreground bg-muted px-3 py-2 rounded-md font-mono text-xs">
                    {user.id.substring(0, 8)}...
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Account Created
                  </label>
                  <p className="text-muted-foreground bg-muted px-3 py-2 rounded-md">
                    {formatDate(user.created_at)}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Last Sign In
                  </label>
                  <p className="text-muted-foreground bg-muted px-3 py-2 rounded-md">
                    {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : "Never"}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button variant="outline">
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Security Settings
              </CardTitle>
              <CardDescription>Manage your password and security preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg gap-4">
                <div className="space-y-1">
                  <p className="font-medium">Password</p>
                  <p className="text-sm text-muted-foreground">
                    Last updated {formatDate(user.updated_at || user.created_at)}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  Change Password
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg gap-4">
                <div className="space-y-1 flex-1">
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <Badge variant="secondary" className="w-fit">
                  Not Enabled
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* App Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                App Preferences
              </CardTitle>
              <CardDescription>Customize your application experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="font-medium flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Theme Preference
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred color scheme
                  </p>
                </div>
                <ThemeSwitcher />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="font-medium flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    Email Notifications
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Receive updates about your offshore operations
                  </p>
                </div>
                <Badge variant="outline">Enabled</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Developer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Developer Information</CardTitle>
              <CardDescription>Raw user data for debugging purposes</CardDescription>
            </CardHeader>
            <CardContent>
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium mb-2 hover:text-primary">
                  View Raw User Data
                </summary>
                <pre className="text-xs font-mono p-4 bg-muted rounded-lg overflow-auto max-h-64 border">
                  {JSON.stringify(user, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
