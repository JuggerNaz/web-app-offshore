"use client";

import React, { useState, useEffect } from "react";
import { useUserRole } from "@/utils/hooks/use-user-role";
import { UserRole } from "@/utils/role-auth-base";
import { InviteDialog } from "./invite-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  UserPlus, 
  Search, 
  ShieldAlert,
  Loader2,
  Check,
  Ban,
  UserCheck,
  Shield,
  Save
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

const AVAILABLE_MODULES = [
  "Field Assets",
  "Planning",
  "Work Packages",
  "Inspection",
  "Reports",
  "Executive Summary",
  "Oracle Migration",
  "Library",
  "Platform 3D",
  "Inspection Type",
  "Attachments",
  "Anomalies & Findings",
  "Smart Query",
  "QA-QC",
  "User Data",
  "Settings"
];

export default function UserManagementPage() {
  const { profile: currentProfile, activeCompanyId } = useUserRole();
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Access Configuration Dialog States
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [editSystemRole, setEditSystemRole] = useState<string>("User");
  const [editModules, setEditModules] = useState<string[]>([]);
  const [editRestrictionType, setEditRestrictionType] = useState<string>("always");
  const [editStartTime, setEditStartTime] = useState<string>("08:00:00");
  const [editEndTime, setEditEndTime] = useState<string>("17:00:00");
  const [editAllowedDays, setEditAllowedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [editTimezone, setEditTimezone] = useState<string>("Asia/Kuala_Lumpur");
  const [editDeviceRestrictionType, setEditDeviceRestrictionType] = useState<string>("none");
  const [isSavingAccess, setIsSavingAccess] = useState(false);

  const handleOpenAccessDialog = (member: any) => {
    setEditingMember(member);
    setEditSystemRole(member.systemRole || "User");
    setEditModules(member.modules || []);
    
    // Load existing profile scheduling parameters
    const userProfile = member.user || {};
    setEditRestrictionType(userProfile.login_restriction_type || "always");
    setEditStartTime(userProfile.allowed_start_time || "08:00:00");
    setEditEndTime(userProfile.allowed_end_time || "17:00:00");
    setEditAllowedDays(userProfile.allowed_days || [1, 2, 3, 4, 5]);
    setEditTimezone(userProfile.timezone || "Asia/Kuala_Lumpur");
    setEditDeviceRestrictionType(userProfile.device_restriction_type || "none");
  };

  const handleModuleToggle = (moduleName: string) => {
    setEditModules((prev) =>
      prev.includes(moduleName)
        ? prev.filter((m) => m !== moduleName)
        : [...prev, moduleName]
    );
  };

  const handleDayToggle = (dayNumber: number) => {
    setEditAllowedDays((prev) =>
      prev.includes(dayNumber)
        ? prev.filter((d) => d !== dayNumber)
        : [...prev, dayNumber].sort()
    );
  };

  const handleSaveAccessConfiguration = async () => {
    if (!editingMember) return;
    try {
      setIsSavingAccess(true);
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (activeCompanyId) {
        headers["x-company-id"] = activeCompanyId;
      }

      const res = await fetch(`/api/admin/users/${editingMember.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          systemRole: editSystemRole,
          modules: editModules,
          login_restriction_type: editRestrictionType,
          allowed_start_time: editStartTime,
          allowed_end_time: editEndTime,
          allowed_days: editAllowedDays,
          timezone: editTimezone,
          device_restriction_type: editDeviceRestrictionType
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setMembers((prev) =>
            prev.map((m) => (m.id === editingMember.id ? json.data : m))
          );
          setEditingMember(null);
        }
      } else {
        const json = await res.json();
        alert(json.error || "Failed to update access configuration");
      }
    } catch (err) {
      console.error("[UserManagement] Failed to save access configuration:", err);
    } finally {
      setIsSavingAccess(false);
    }
  };

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      const headers: HeadersInit = {};
      if (activeCompanyId) {
        headers["x-company-id"] = activeCompanyId;
      }

      const res = await fetch("/api/admin/users", { headers });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setMembers(json.data || []);
        } else {
          setErrorMsg(json.error || "Failed to load company members.");
        }
      } else {
        let errText = `Error ${res.status}: ${res.statusText}`;
        try {
          const json = await res.json();
          if (json.error) errText = json.error;
        } catch (_) {}
        setErrorMsg(errText);
      }
    } catch (err: any) {
      console.error("[UserManagement] Error loading members:", err);
      setErrorMsg(err.message || "An unexpected error occurred while loading members.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [activeCompanyId]);

  const handleRoleChange = async (membershipId: string, newRole: UserRole) => {
    try {
      setActionInProgress(membershipId);
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (activeCompanyId) {
        headers["x-company-id"] = activeCompanyId;
      }

      const res = await fetch(`/api/admin/users/${membershipId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setMembers((prev) =>
            prev.map((m) => (m.id === membershipId ? json.data : m))
          );
        }
      } else {
        const json = await res.json();
        alert(json.error || "Failed to update role");
      }
    } catch (err) {
      console.error("[UserManagement] Role change failed:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleToggleActiveStatus = async (membershipId: string, currentStatus: boolean) => {
    try {
      setActionInProgress(membershipId);
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (activeCompanyId) {
        headers["x-company-id"] = activeCompanyId;
      }

      const res = await fetch(`/api/admin/users/${membershipId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setMembers((prev) =>
            prev.map((m) => (m.id === membershipId ? json.data : m))
          );
        }
      } else {
        const json = await res.json();
        alert(json.error || "Failed to toggle status");
      }
    } catch (err) {
      console.error("[UserManagement] Status change failed:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeactivate = async (membershipId: string) => {
    if (!confirm("Are you sure you want to deactivate this membership?")) return;

    try {
      setActionInProgress(membershipId);
      const headers: HeadersInit = {};
      if (activeCompanyId) {
        headers["x-company-id"] = activeCompanyId;
      }

      const res = await fetch(`/api/admin/users/${membershipId}`, {
        method: "DELETE",
        headers,
      });

      if (res.ok) {
        setMembers((prev) =>
          prev.map((m) => m.id === membershipId ? { ...m, is_active: false } : m)
        );
      } else {
        const json = await res.json();
        alert(json.error || "Failed to deactivate member");
      }
    } catch (err) {
      console.error("[UserManagement] Deactivation failed:", err);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleUserInvited = (newMembership: any) => {
    setMembers((prev) => [newMembership, ...prev]);
  };

  // Filter members based on search query
  const filteredMembers = members.filter((member) => {
    const user = member.user || {};
    const name = (user.full_name || "").toLowerCase();
    const email = (user.email || "").toLowerCase();
    const designation = (user.designation || "").toLowerCase();
    const q = searchQuery.toLowerCase();
    return name.includes(q) || email.includes(q) || designation.includes(q);
  });

  return (
    <div className="flex-1 space-y-6 p-8 overflow-y-auto">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            User Administration
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Invite colleagues, modify roles, or deactivate access for this company.
          </p>
        </div>
        <Button
          onClick={() => setInviteDialogOpen(true)}
          className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold shadow-lg hover:shadow-blue-500/10 active:scale-95 transition-all"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Filters bar */}
      <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm">
        <div className="relative grow max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-10 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/15"
          />
        </div>
        {isLoading && <Loader2 className="h-5 w-5 animate-spin text-blue-500 ml-2" />}
      </div>

      {/* Main Members Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-850 shadow-md overflow-hidden">
        {errorMsg ? (
          <div className="flex flex-col items-center justify-center p-20 text-center space-y-3">
            <ShieldAlert className="h-12 w-12 text-red-500 animate-pulse" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-red-600 dark:text-red-400">Failed to load members</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                {errorMsg}
              </p>
              <Button 
                onClick={fetchMembers} 
                variant="outline" 
                className="mt-4 border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Retry Request
              </Button>
            </div>
          </div>
        ) : isLoading && members.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading company members...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 text-slate-400" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">No users found</h3>
              <p className="text-sm text-slate-400 max-w-xs">
                Try resetting your search query or invite a new member to join this workspace.
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-950/60">
              <TableRow className="border-b border-slate-100 dark:border-slate-850">
                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400">Team Member</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400">Designation</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400">System Role</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400">Status</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => {
                const user = member.user || {};
                const isSelf = user.id === currentProfile?.id;
                const isPending = actionInProgress === member.id;

                // Initials fallback for avatar
                const initials = (user.full_name || "")
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || user.email?.slice(0, 2).toUpperCase() || "??";

                return (
                  <TableRow 
                    key={member.id} 
                    className="border-b border-slate-100 dark:border-slate-850 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    {/* User profile & email */}
                    <TableCell className="py-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-800">
                          <AvatarImage src={user.avatar_url} />
                          <AvatarFallback className="bg-gradient-to-tr from-blue-600 to-cyan-500 text-white font-bold text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center">
                            {user.full_name || "Invited User"}
                            {isSelf && (
                              <Badge className="ml-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none font-bold text-[10px] uppercase">
                                You
                              </Badge>
                            )}
                          </span>
                          <span className="text-xs text-slate-400 mt-0.5">{user.email}</span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Designation */}
                    <TableCell>
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {user.designation || "—"}
                      </span>
                    </TableCell>

                    {/* System Role Selection */}
                    <TableCell>
                      {isSelf ? (
                        <Badge variant="outline" className="rounded-lg py-1 px-2.5 font-bold uppercase text-[10.5px] border-slate-800 text-slate-400 bg-slate-950/20">
                          {member.role.replace("_", " ")}
                        </Badge>
                      ) : (
                        <Select
                          value={member.role}
                          disabled={isPending}
                          onValueChange={(val) => handleRoleChange(member.id, val as UserRole)}
                        >
                          <SelectTrigger className="h-9 w-[160px] rounded-lg bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-1 focus:ring-blue-500/20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-950 border-slate-850 text-white">
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="inspector">Inspector</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="company_admin">Company Admin</SelectItem>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>

                    {/* Active/Inactive Status Badge */}
                    <TableCell>
                      {isSelf ? (
                        <Badge className="bg-green-500/15 text-green-500 border-none font-bold py-0.5 px-2 rounded-full text-[10px] uppercase tracking-wider">
                          Active
                        </Badge>
                      ) : (
                        <button
                          disabled={isPending}
                          onClick={() => handleToggleActiveStatus(member.id, member.is_active)}
                          className="hover:scale-105 transition-transform"
                        >
                          {member.is_active ? (
                            <Badge className="bg-green-500/15 hover:bg-green-500/20 text-green-500 border-none font-bold py-0.5 px-2 rounded-full text-[10px] uppercase tracking-wider">
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-500/15 hover:bg-slate-500/20 text-slate-400 border-none font-bold py-0.5 px-2 rounded-full text-[10px] uppercase tracking-wider">
                              Inactive
                            </Badge>
                          )}
                        </button>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      {isSelf ? (
                        <span className="text-xs font-semibold text-slate-500">Restricted</span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          {member.is_active && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isPending}
                              onClick={() => handleOpenAccessDialog(member)}
                              className="h-8 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                            >
                              <Shield className="h-3.5 w-3.5 mr-1" />
                              Access
                            </Button>
                          )}
                          {member.is_active ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isPending}
                              onClick={() => handleDeactivate(member.id)}
                              className="h-8 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            >
                              <Ban className="h-3.5 w-3.5 mr-1" />
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isPending}
                              onClick={() => handleToggleActiveStatus(member.id, member.is_active)}
                              className="h-8 rounded-lg text-green-500 hover:text-green-600 hover:bg-green-500/10"
                            >
                              <UserCheck className="h-3.5 w-3.5 mr-1" />
                              Activate
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Invite Member modal */}
      <InviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onUserInvited={handleUserInvited}
        activeCompanyId={activeCompanyId}
      />

      {/* Access Configuration Dialog */}
      <Dialog open={!!editingMember} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent className="sm:max-w-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <Shield className="h-5 w-5 text-amber-500" />
              Access Configuration
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Change role, module permissions, and scheduling for {editingMember?.user?.email || "this user"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">System Role</label>
              <Select value={editSystemRole} onValueChange={setEditSystemRole}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-850 text-white">
                  <SelectItem value="Admin">Administrator</SelectItem>
                  <SelectItem value="Operator">Operator</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                  <SelectItem value="User">Basic User</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal">
                Admins have full access to manage roles. Other roles are for categorizing access.
              </p>
            </div>

            {/* Device Restriction Section */}
            <div className="border-t border-slate-100 dark:border-slate-850 pt-5 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Device Restriction</label>
              <Select value={editDeviceRestrictionType} onValueChange={setEditDeviceRestrictionType}>
                <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                  <SelectValue placeholder="Select device access rule" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-850 text-white">
                  <SelectItem value="none">Any Device (No Restrictions)</SelectItem>
                  <SelectItem value="enforced">Registered Devices Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Login Scheduling Section */}
            <div className="border-t border-slate-100 dark:border-slate-850 pt-5 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Access Schedule</label>
                <Select value={editRestrictionType} onValueChange={setEditRestrictionType}>
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                    <SelectValue placeholder="Select schedule type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-950 border-slate-850 text-white">
                    <SelectItem value="always">Always Allowed (24/7)</SelectItem>
                    <SelectItem value="scheduled">Scheduled Access</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editRestrictionType === "scheduled" && (
                <div className="space-y-4 p-4 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-850 animate-in fade-in duration-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Start Time</label>
                      <Input
                        type="time"
                        step="1"
                        value={editStartTime}
                        onChange={(e) => setEditStartTime(e.target.value)}
                        className="h-9 rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">End Time</label>
                      <Input
                        type="time"
                        step="1"
                        value={editEndTime}
                        onChange={(e) => setEditEndTime(e.target.value)}
                        className="h-9 rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Allowed Days</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { num: 1, label: "M" },
                        { num: 2, label: "T" },
                        { num: 3, label: "W" },
                        { num: 4, label: "T" },
                        { num: 5, label: "F" },
                        { num: 6, label: "S" },
                        { num: 7, label: "S" }
                      ].map((day) => {
                        const active = editAllowedDays.includes(day.num);
                        return (
                          <button
                            key={day.num}
                            type="button"
                            onClick={() => handleDayToggle(day.num)}
                            className={`h-9 w-9 rounded-lg font-bold text-xs transition-all active:scale-90 ${
                              active
                                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Timezone</label>
                    <Select value={editTimezone} onValueChange={setEditTimezone}>
                      <SelectTrigger className="h-9 rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-950 border-slate-850 text-white">
                        <SelectItem value="Asia/Kuala_Lumpur">Kuala Lumpur / Singapore (GMT+8)</SelectItem>
                        <SelectItem value="UTC">UTC / GMT</SelectItem>
                        <SelectItem value="Asia/Jakarta">Jakarta (GMT+7)</SelectItem>
                        <SelectItem value="Asia/Dubai">Dubai (GMT+4)</SelectItem>
                        <SelectItem value="Europe/London">London (GMT+0/+1)</SelectItem>
                        <SelectItem value="America/New_York">New York (EST/EDT)</SelectItem>
                        <SelectItem value="Australia/Sydney">Sydney (AEST/AEDT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-850 pt-5 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Module Access</label>
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-850">
                {AVAILABLE_MODULES.map((mod) => (
                  <div key={mod} className="flex flex-row items-center space-x-2.5 py-1">
                    <Checkbox
                      id={`mod-${mod}`}
                      checked={editModules.includes(mod)}
                      onCheckedChange={() => handleModuleToggle(mod)}
                      className="rounded-md border-slate-350 dark:border-slate-700 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <label
                      htmlFor={`mod-${mod}`}
                      className="text-sm font-semibold cursor-pointer text-slate-750 dark:text-slate-350 select-none"
                    >
                      {mod}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="sm:justify-between border-t border-slate-100 dark:border-slate-850 pt-4 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditingMember(null)}
              className="rounded-xl border-none hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSavingAccess}
              onClick={handleSaveAccessConfiguration}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 rounded-xl px-5 font-semibold shadow-lg hover:shadow-blue-500/10 active:scale-95 transition-all"
            >
              {isSavingAccess ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
