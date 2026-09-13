"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { UserRole } from "@/utils/role-auth-base";
import {
  Check,
  Copy,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Building2,
  KeyRound,
  UserPlus,
  Shield,
  Loader2,
} from "lucide-react";

interface TenantOption {
  id: string;
  name: string;
  slug: string;
  selected: boolean;
  role: UserRole;
}

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserInvited: (newUser: any) => void;
  activeCompanyId?: string | null;
  isSuperAdmin?: boolean;
}

export function InviteDialog({
  open,
  onOpenChange,
  onUserInvited,
  activeCompanyId,
  isSuperAdmin = false,
}: InviteDialogProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [designation, setDesignation] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [singleRole, setSingleRole] = useState<UserRole>("viewer");
  
  // Multi-tenant assignments state for Super Admins
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Success state with credentials report
  const [successResult, setSuccessResult] = useState<{
    email: string;
    fullName: string;
    password?: string;
    memberships: Array<{ companyName: string; role: string }>;
    notice?: string;
  } | null>(null);

  const [copiedCredentials, setCopiedCredentials] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Generate random strong password
  const handleGeneratePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const specialChars = "!@#$%^&*";
    let generated = "";
    for (let i = 0; i < 8; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    generated += specialChars.charAt(Math.floor(Math.random() * specialChars.length));
    generated += Math.floor(10 + Math.random() * 90);
    setPassword(generated);
    setShowPassword(true);
  };

  // Fetch available companies when dialog opens
  useEffect(() => {
    if (open) {
      if (isSuperAdmin) {
        fetchOrganizations();
      }
      if (!password) {
        handleGeneratePassword();
      }
    }
  }, [open, isSuperAdmin]);

  const fetchOrganizations = async () => {
    try {
      setIsLoadingTenants(true);
      const res = await fetch("/api/admin/organizations");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const mapped = json.data.map((org: any) => ({
            id: org.id,
            name: org.name,
            slug: org.slug,
            selected: activeCompanyId ? org.id === activeCompanyId : false,
            role: (org.id === activeCompanyId ? "inspector" : "viewer") as UserRole,
          }));
          // Ensure at least one is selected
          if (mapped.length > 0 && !mapped.some((m: any) => m.selected)) {
            mapped[0].selected = true;
          }
          setTenants(mapped);
        }
      }
    } catch (err) {
      console.error("[InviteDialog] Failed to fetch organizations:", err);
    } finally {
      setIsLoadingTenants(false);
    }
  };

  const handleTenantToggle = (id: string) => {
    setTenants((prev) =>
      prev.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleTenantRoleChange = (id: string, newRole: UserRole) => {
    setTenants((prev) =>
      prev.map((t) => (t.id === id ? { ...t, role: newRole } : t))
    );
  };

  const resetForm = () => {
    setEmail("");
    setFullName("");
    setDesignation("");
    setPassword("");
    setSingleRole("viewer");
    setErrorMessage("");
    setSuccessResult(null);
    setCopiedCredentials(false);
    setCopiedPassword(false);
    setShowPassword(false);
    handleGeneratePassword();
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const handleCopyCredentials = () => {
    if (!successResult) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const membershipsList = successResult.memberships
      .map((m) => `• ${m.companyName}: ${m.role.replace("_", " ")}`)
      .join("\n");

    const text = `Welcome to the Offshore Data Management Platform!\n\nPortal URL: ${origin}/sign-in\nEmail: ${successResult.email}\nTemporary Password: ${successResult.password || "Set by administrator"}\n\nAssigned Workspaces:\n${membershipsList}\n\nPlease sign in and update your password under Profile Settings.`;

    navigator.clipboard.writeText(text);
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 2500);
  };

  const handleCopyPassword = () => {
    if (!successResult?.password) return;
    navigator.clipboard.writeText(successResult.password);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName) return;

    try {
      setIsSubmitting(true);
      setErrorMessage("");

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (activeCompanyId) {
        headers["x-company-id"] = activeCompanyId;
      }

      let payload: any = {
        email: email.trim(),
        full_name: fullName.trim(),
        designation: designation.trim(),
        password: password.trim() || undefined,
      };

      if (isSuperAdmin && tenants.length > 0) {
        const selectedAssignments = tenants
          .filter((t) => t.selected)
          .map((t) => ({
            company_id: t.id,
            role: t.role,
          }));

        if (selectedAssignments.length === 0) {
          throw new Error("Please select at least one organization for this user.");
        }
        payload.tenant_assignments = selectedAssignments;
      } else {
        payload.role = singleRole;
      }

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to create user");
      }

      // Notify parent table
      onUserInvited(json.data);

      // Build summary of memberships for success screen
      const membershipSummary: Array<{ companyName: string; role: string }> = [];
      if (json.data?.memberships && Array.isArray(json.data.memberships)) {
        json.data.memberships.forEach((m: any) => {
          membershipSummary.push({
            companyName: m.company?.name || "Workspace",
            role: m.role || "viewer",
          });
        });
      } else if (isSuperAdmin && tenants.length > 0) {
        tenants
          .filter((t) => t.selected)
          .forEach((t) => {
            membershipSummary.push({
              companyName: t.name,
              role: t.role,
            });
          });
      } else {
        membershipSummary.push({
          companyName: "Current Workspace",
          role: singleRole,
        });
      }

      setSuccessResult({
        email: email.trim(),
        fullName: fullName.trim(),
        password: password.trim(),
        memberships: membershipSummary,
        notice: json.data?.notice,
      });
    } catch (err: any) {
      console.error("[InviteDialog] Error:", err);
      setErrorMessage(err.message || "Failed to create user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] bg-slate-900 text-white border-slate-800 rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh]">
        {successResult ? (
          <div className="space-y-5 py-2">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-1">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <DialogTitle className="text-xl font-bold tracking-tight text-white">
                User Account Created!
              </DialogTitle>
              <DialogDescription className="text-slate-300 text-sm max-w-sm">
                <strong className="text-white">{successResult.fullName}</strong> ({successResult.email}) has been provisioned.
              </DialogDescription>
            </div>

            {/* Credentials Card */}
            <div className="space-y-3 rounded-2xl bg-slate-950/80 border border-slate-800 p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-cyan-400" />
                  <span>Login Credentials</span>
                </div>
                <span className="text-[11px] text-amber-400/90 font-medium">
                  Share directly with user
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs py-1">
                <span className="text-slate-400 font-medium">Email:</span>
                <span className="col-span-2 font-mono text-white select-all">
                  {successResult.email}
                </span>

                <span className="text-slate-400 font-medium">Default Password:</span>
                <div className="col-span-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-emerald-400 font-bold select-all">
                    {successResult.password || "••••••••"}
                  </span>
                  {successResult.password && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleCopyPassword}
                      className="h-6 px-2 text-[11px] text-slate-400 hover:text-white"
                    >
                      {copiedPassword ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* Assigned Workspaces */}
              <div className="border-t border-slate-800/80 pt-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  Assigned Workspace(s) & Roles:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {successResult.memberships.map((m, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl text-xs"
                    >
                      <Building2 className="h-3 w-3 text-blue-400" />
                      <span className="font-medium text-slate-200">{m.companyName}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-cyan-400 font-semibold capitalize">
                        {m.role.replace("_", " ")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Action to copy all credentials */}
            <Button
              type="button"
              onClick={handleCopyCredentials}
              className={`h-11 w-full rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 ${
                copiedCredentials
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                  : "bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20"
              }`}
            >
              {copiedCredentials ? (
                <>
                  <Check className="h-4 w-4" />
                  Credentials Copied to Clipboard!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Full Login Details
                </>
              )}
            </Button>

            <DialogFooter className="pt-1 flex sm:justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                className="rounded-xl border-slate-800 hover:bg-slate-800 hover:text-white text-xs"
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Create Another User
              </Button>
              <Button
                type="button"
                onClick={() => handleClose(false)}
                className="rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs px-6"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-blue-400" />
                Create New User
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-sm">
                Provision a user account with a default password and assign workspace roles.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-3 rounded-xl text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-semibold">{errorMessage}</div>
              </div>
            )}

            <div className="space-y-3.5">
              {/* Email Address */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Email Address *
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 rounded-xl bg-slate-950/50 border-slate-800 text-white focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500"
                />
              </div>

              {/* Full Name & Designation */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Full Name *
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="e.g. John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="h-11 rounded-xl bg-slate-950/50 border-slate-800 text-white focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="designation" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Designation
                  </Label>
                  <Input
                    id="designation"
                    type="text"
                    placeholder="e.g. Lead Inspector"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="h-11 rounded-xl bg-slate-950/50 border-slate-800 text-white focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* Default Password with Generator & View Toggle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Default Password *
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGeneratePassword}
                    className="h-6 px-2 text-[11px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 flex items-center gap-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    Generate Strong Password
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Default login password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 pr-10 rounded-xl bg-slate-950/50 border-slate-800 text-white font-mono focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  The user can sign in immediately with this password and update it anytime in profile settings.
                </p>
              </div>

              {/* Multi-Tenant Role Matrix (Super Admin) OR Single-Tenant Role (Company Admin) */}
              {isSuperAdmin ? (
                <div className="space-y-2 border-t border-slate-800/80 pt-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-blue-400" />
                      Workspace Access & Roles
                    </Label>
                    <span className="text-[11px] text-slate-500">Assign across organizations</span>
                  </div>

                  {isLoadingTenants ? (
                    <div className="flex items-center justify-center p-6 text-slate-400">
                      <Loader2 className="h-5 w-5 animate-spin mr-2 text-blue-500" />
                      <span className="text-xs">Loading organizations...</span>
                    </div>
                  ) : tenants.length === 0 ? (
                    <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800 text-xs text-slate-400">
                      No additional organizations found. Current workspace will be assigned.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-slate-950/50 rounded-2xl border border-slate-800">
                      {tenants.map((t) => (
                        <div
                          key={t.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                            t.selected
                              ? "bg-slate-900 border-blue-500/30"
                              : "bg-slate-950/30 border-slate-850 opacity-60"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Checkbox
                              id={`tenant-${t.id}`}
                              checked={t.selected}
                              onCheckedChange={() => handleTenantToggle(t.id)}
                              className="rounded-md border-slate-700 data-[state=checked]:bg-blue-600"
                            />
                            <label
                              htmlFor={`tenant-${t.id}`}
                              className="text-xs font-semibold cursor-pointer text-white"
                            >
                              {t.name}
                            </label>
                          </div>

                          {t.selected && (
                            <Select
                              value={t.role}
                              onValueChange={(val) => handleTenantRoleChange(t.id, val as UserRole)}
                            >
                              <SelectTrigger className="h-8 w-36 rounded-lg bg-slate-950 border-slate-800 text-xs text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-950 border-slate-800 text-white">
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="inspector">Inspector</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="company_admin">Company Admin</SelectItem>
                                <SelectItem value="super_admin">Super Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 border-t border-slate-800/80 pt-3">
                  <Label htmlFor="role" className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    System Role in Current Workspace
                  </Label>
                  <Select value={singleRole} onValueChange={(val) => setSingleRole(val as UserRole)}>
                    <SelectTrigger className="h-11 rounded-xl bg-slate-950/50 border-slate-800 text-white focus:ring-2 focus:ring-blue-500/20 text-left">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-950 border-slate-800 text-white">
                      <SelectItem value="viewer">Viewer (Read-only access)</SelectItem>
                      <SelectItem value="inspector">Inspector (Perform inspections & attach files)</SelectItem>
                      <SelectItem value="manager">Manager (Approve reports & manage assets)</SelectItem>
                      <SelectItem value="company_admin">Company Admin (Full company configurations)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isSubmitting}
                className="rounded-xl border-slate-800 hover:bg-slate-800 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/10"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating User...
                  </>
                ) : (
                  "Create User"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
