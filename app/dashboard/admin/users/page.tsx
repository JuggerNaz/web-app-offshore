"use client";

import { useState, useMemo } from "react";
import { useUserRole } from "@/utils/hooks/use-user-role";
import { UserRole } from "@/utils/role-auth-base";
import { InviteDialog } from "./invite-dialog";
import { DeleteDialog } from "./delete-dialog";
import { ResetPasswordDialog } from "@/components/admin/reset-password-dialog";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ScrollSentinel } from "@/components/data-table/scroll-sentinel";
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
  Save,
  KeyRound,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  UserX,
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
  "Interface",
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
  const { profile: currentProfile, activeCompanyId, company, role, systemRole, isLoading: isRoleLoading } = useUserRole();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 300);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("active");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  type SortKey = "name" | "designation" | "role" | "status";
  type SortDirection = "asc" | "desc";

  const [sortKey, setSortKey] = useState<SortKey | null>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  // Scroll-to-load member list; the API pages memberships and applies the
  // search server-side (name / email / designation).
  const {
    items: members,
    totalItems,
    isLoading,
    error: listError,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
    updateItem,
    removeItem,
    prependItem,
  } = useInfiniteList<any>({
    queryKey: ["admin", "users", activeCompanyId, debouncedSearch, sortKey, sortDirection],
    getPageUrl: (page) =>
      `/api/admin/users?page=${page}&pageSize=50${
        debouncedSearch ? `&q=${encodeURIComponent(debouncedSearch)}` : ""
      }${sortKey ? `&sortBy=${sortKey}&sortOrder=${sortDirection}` : ""}`,
    getHeaders: () =>
      activeCompanyId ? { "x-company-id": activeCompanyId } : ({} as Record<string, string>),
    enabled: !isRoleLoading,
  });

  const sortedMembers = useMemo(() => {
    let filtered = members;
    if (statusFilter === "active") {
      filtered = members.filter((m) => m.is_active !== false);
    } else if (statusFilter === "archived") {
      filtered = members.filter((m) => m.is_active === false);
    }

    if (!sortKey) return filtered;

    return [...filtered].sort((a, b) => {
      if (sortKey === "status") {
        const aActive = a.is_active ? 1 : 0;
        const bActive = b.is_active ? 1 : 0;
        return sortDirection === "asc" ? bActive - aActive : aActive - bActive;
      }

      let aVal = "";
      let bVal = "";

      if (sortKey === "name") {
        const aUser = (Array.isArray(a.user) ? a.user[0] : a.user) || {};
        const bUser = (Array.isArray(b.user) ? b.user[0] : b.user) || {};
        aVal = (aUser.full_name || aUser.email || "").toLowerCase();
        bVal = (bUser.full_name || bUser.email || "").toLowerCase();
      } else if (sortKey === "designation") {
        const aUser = (Array.isArray(a.user) ? a.user[0] : a.user) || {};
        const bUser = (Array.isArray(b.user) ? b.user[0] : b.user) || {};
        aVal = (aUser.designation || "").toLowerCase();
        bVal = (bUser.designation || "").toLowerCase();
      } else if (sortKey === "role") {
        aVal = (a.systemRole || a.role || "").toLowerCase();
        bVal = (b.systemRole || b.role || "").toLowerCase();
      }

      const comparison = aVal.localeCompare(bVal);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [members, statusFilter, sortKey, sortDirection]);

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return (
        <ArrowUpDown className="h-3.5 w-3.5 text-slate-400/50 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors ml-1" />
      );
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 ml-1 font-bold" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 ml-1 font-bold" />
    );
  };

  const errorMsg = listError;
  const isLoadingList = isLoading || isRoleLoading;

  // Access Configuration Dialog States
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<any | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingMember, setDeletingMember] = useState<any | null>(null);
  const [editSystemRole, setEditSystemRole] = useState<string>("User");
  const [editModules, setEditModules] = useState<string[]>([]);
  const [editRestrictionType, setEditRestrictionType] = useState<string>("always");
  const [editStartTime, setEditStartTime] = useState<string>("08:00:00");
  const [editEndTime, setEditEndTime] = useState<string>("17:00:00");
  const [editAllowedDays, setEditAllowedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [editTimezone, setEditTimezone] = useState<string>("Asia/Kuala_Lumpur");
  const [editDeviceRestrictionType, setEditDeviceRestrictionType] = useState<string>("none");
  const [editStartDate, setEditStartDate] = useState<string>("");
  const [editEndDate, setEditEndDate] = useState<string>("");
  const [isSavingAccess, setIsSavingAccess] = useState(false);

  const handleOpenAccessDialog = async (member: any) => {
    setEditingMember(member);
    const initialSysRole = member.systemRole && member.systemRole !== "User" 
      ? member.systemRole 
      : (member.role === "super_admin" ? "Super Admin" : member.role === "company_admin" ? "Company Admin" : member.role === "manager" ? "Manager" : member.role === "inspector" ? "Operator" : (member.systemRole || "User"));
    setEditSystemRole(initialSysRole);
    setEditModules(member.modules || []);
    
    // Load existing profile scheduling parameters safely (unwrapping array if returned as array)
    const rawUserProfile = member.user;
    const userProfile = (Array.isArray(rawUserProfile) ? rawUserProfile[0] : rawUserProfile) || {};
    setEditRestrictionType(userProfile.login_restriction_type || "always");
    setEditStartTime(userProfile.allowed_start_time || "08:00:00");
    setEditEndTime(userProfile.allowed_end_time || "17:00:00");
    setEditAllowedDays(
      Array.isArray(userProfile.allowed_days) && userProfile.allowed_days.length > 0
        ? userProfile.allowed_days
        : [1, 2, 3, 4, 5]
    );
    setEditTimezone(userProfile.timezone || "Asia/Kuala_Lumpur");
    setEditDeviceRestrictionType(userProfile.device_restriction_type || "none");
    setEditStartDate(userProfile.allowed_start_date ? String(userProfile.allowed_start_date).slice(0, 10) : "");
    setEditEndDate(userProfile.allowed_end_date ? String(userProfile.allowed_end_date).slice(0, 10) : "");

    // Fetch fresh membership details to ensure scheduling/restrictions are accurately synced with the database
    try {
      const headers: HeadersInit = {};
      if (activeCompanyId) {
        headers["x-company-id"] = activeCompanyId;
      }
      const freshRes = await fetch(`/api/admin/users/${member.id}`, { headers });
      if (freshRes.ok) {
        const freshJson = await freshRes.json();
        if (freshJson.success && freshJson.data) {
          const freshMember = freshJson.data;
          const freshUser = (Array.isArray(freshMember.user) ? freshMember.user[0] : freshMember.user) || {};
          if (freshUser.login_restriction_type) {
            setEditRestrictionType(freshUser.login_restriction_type);
          }
          if (freshUser.allowed_start_time) {
            setEditStartTime(freshUser.allowed_start_time);
          }
          if (freshUser.allowed_end_time) {
            setEditEndTime(freshUser.allowed_end_time);
          }
          if (Array.isArray(freshUser.allowed_days) && freshUser.allowed_days.length > 0) {
            setEditAllowedDays(freshUser.allowed_days);
          }
          if (freshUser.timezone) {
            setEditTimezone(freshUser.timezone);
          }
          if (freshUser.device_restriction_type) {
            setEditDeviceRestrictionType(freshUser.device_restriction_type);
          }
          setEditStartDate(freshUser.allowed_start_date ? String(freshUser.allowed_start_date).slice(0, 10) : "");
          setEditEndDate(freshUser.allowed_end_date ? String(freshUser.allowed_end_date).slice(0, 10) : "");
          if (freshMember.systemRole) {
            setEditSystemRole(freshMember.systemRole);
          }
          if (Array.isArray(freshMember.modules)) {
            setEditModules(freshMember.modules);
          }
          // Update table list state with fresh user data
          updateItem((m: any) => (m.id === member.id ? freshMember : m));
        }
      }
    } catch (_) {}
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

      // Map systemRole to company_memberships.role
      const systemRoleToMembershipRole: Record<string, UserRole> = {
        "Super Admin": "super_admin",
        "Company Admin": "company_admin",
        "Admin": "company_admin",
        "Administrator": "company_admin",
        "Manager": "manager",
        "Operator": "inspector",
        "Viewer": "viewer",
        "User": "viewer",
      };
      const mappedRole = systemRoleToMembershipRole[editSystemRole];

      const res = await fetch(`/api/admin/users/${editingMember.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          systemRole: editSystemRole,
          ...(mappedRole ? { role: mappedRole } : {}),
          modules: editModules,
          login_restriction_type: editRestrictionType,
          allowed_start_time: editStartTime,
          allowed_end_time: editEndTime,
          allowed_days: editAllowedDays,
          timezone: editTimezone,
          device_restriction_type: editDeviceRestrictionType,
          allowed_start_date: editStartDate ? editStartDate : null,
          allowed_end_date: editEndDate ? editEndDate : null,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          updateItem((m: any) => (m.id === editingMember.id ? json.data : m));
          setEditingMember(null);
        }
      } else {
        const json = await res.json();
        alert(json.error || "Failed to update access configuration");
      }
    } catch (err) {
      console.warn("[UserManagement] Failed to save access configuration:", err);
    } finally {
      setIsSavingAccess(false);
    }
  };

  const handleRoleChange = async (membershipId: string, newRole: UserRole) => {
    try {
      setActionInProgress(membershipId);
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (activeCompanyId) {
        headers["x-company-id"] = activeCompanyId;
      }

      const roleToSystemRole: Record<string, string> = {
        super_admin: "Super Admin",
        company_admin: "Company Admin",
        manager: "Manager",
        inspector: "Operator",
        viewer: "Viewer",
      };

      const res = await fetch(`/api/admin/users/${membershipId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ 
          role: newRole,
          systemRole: roleToSystemRole[newRole] || "User",
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          updateItem((m: any) => (m.id === membershipId ? json.data : m));
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
          updateItem((m: any) => (m.id === membershipId ? json.data : m));
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
        updateItem((m: any) => (m.id === membershipId ? { ...m, is_active: false } : m));
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
    prependItem(newMembership);
  };

  const handleOpenDeleteDialog = (member?: any) => {
    setDeletingMember(member || null);
    setDeleteDialogOpen(true);
  };

  const handleUserDeleted = (membershipId: string, userId: string, action?: string, message?: string) => {
    if (action === "permanent_delete") {
      removeItem((m: any) => m.id === membershipId || m.user_id === userId);
    } else {
      // Soft-deleted: update active status in table so they move into the Archived tab
      updateItem((m: any) => (m.id === membershipId ? { ...m, is_active: false, user: { ...(m.user || {}), is_active: false } } : m));
    }
    refetch();
    if (message) {
      alert(message);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8 overflow-y-auto">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            User Administration
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-1.5">
            <span>Invite colleagues, modify roles, or deactivate access for</span>
            <span className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-900 text-xs">
              <Building2 className="h-3.5 w-3.5" />
              {company?.name || "Current Workspace"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            onClick={() => handleOpenDeleteDialog()}
            className="rounded-xl border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold shadow-sm active:scale-95 transition-all"
            title="Delete or remove a user from the workspace"
          >
            <UserX className="h-4 w-4 mr-1.5" />
            Remove User
          </Button>
          <Button
            onClick={() => setInviteDialogOpen(true)}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold shadow-lg hover:shadow-blue-500/10 active:scale-95 transition-all"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 shadow-sm">
        <div className="flex items-center gap-2 grow max-w-sm">
          <div className="relative grow">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-10 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/15"
            />
          </div>
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-blue-500 shrink-0" />}
        </div>

        {/* Status Filter Segmented Controls */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200/60 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === "active"
                ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Active ({members.filter((m) => m.is_active !== false).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("archived")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === "archived"
                ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Archived ({members.filter((m) => m.is_active === false).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === "all"
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            All ({members.length})
          </button>
        </div>
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
                onClick={refetch} 
                variant="outline" 
                className="mt-4 border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Retry Request
              </Button>
            </div>
          </div>
        ) : isLoadingList && members.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-20 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading company members...</p>
          </div>
        ) : members.length === 0 ? (
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
                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 py-3.5">
                  <button
                    type="button"
                    onClick={() => handleSort("name")}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group select-none font-bold text-xs uppercase tracking-wider"
                    title={`Sort by Team Member (${sortKey === "name" && sortDirection === "asc" ? "Descending" : "Ascending"})`}
                  >
                    <span>Team Member</span>
                    {renderSortIcon("name")}
                  </button>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 py-3.5">
                  <button
                    type="button"
                    onClick={() => handleSort("designation")}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group select-none font-bold text-xs uppercase tracking-wider"
                    title={`Sort by Designation (${sortKey === "designation" && sortDirection === "asc" ? "Descending" : "Ascending"})`}
                  >
                    <span>Designation</span>
                    {renderSortIcon("designation")}
                  </button>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 py-3.5">
                  <button
                    type="button"
                    onClick={() => handleSort("role")}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group select-none font-bold text-xs uppercase tracking-wider"
                    title={`Sort by System Role (${sortKey === "role" && sortDirection === "asc" ? "Descending" : "Ascending"})`}
                  >
                    <span>System Role</span>
                    {renderSortIcon("role")}
                  </button>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 py-3.5">
                  <button
                    type="button"
                    onClick={() => handleSort("status")}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group select-none font-bold text-xs uppercase tracking-wider"
                    title={`Sort by Status (${sortKey === "status" && sortDirection === "asc" ? "Descending" : "Ascending"})`}
                  >
                    <span>Status</span>
                    {renderSortIcon("status")}
                  </button>
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-400 text-right py-3.5">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMembers.map((member) => {
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
                          <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                            {user.full_name || "Invited User"}
                            {isSelf && (
                              <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none font-bold text-[10px] uppercase">
                                You
                              </Badge>
                            )}
                            {user.login_restriction_type === "scheduled" && (
                              <Badge variant="outline" className="text-[9.5px] py-0 px-1.5 font-medium border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10" title={`Scheduled Access${user.allowed_start_date ? ` from ${user.allowed_start_date}` : ''}${user.allowed_end_date ? ` to ${user.allowed_end_date}` : ''}`}>
                                {user.allowed_start_date || user.allowed_end_date 
                                  ? `${user.allowed_start_date ? String(user.allowed_start_date).slice(5) : "Start"} → ${user.allowed_end_date ? String(user.allowed_end_date).slice(5) : "End"}`
                                  : "Scheduled"}
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
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isPending}
                            onClick={() => setResetPasswordUser({
                              id: member.id,
                              email: user.email,
                              full_name: user.full_name,
                            })}
                            className="h-8 rounded-lg text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                            title="Reset Password & Set One-Time Password"
                          >
                            <KeyRound className="h-3.5 w-3.5 mr-1" />
                            Reset Pass
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isPending}
                            onClick={() => handleOpenAccessDialog(member)}
                            className="h-8 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                            title="Module Access & Security Configuration"
                          >
                            <Shield className="h-3.5 w-3.5 mr-1" />
                            Access
                          </Button>
                          {member.is_active ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isPending}
                              onClick={() => handleDeactivate(member.id)}
                              className="h-8 rounded-lg text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                              title="Deactivate Member"
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
                              title="Activate Member"
                            >
                              <UserCheck className="h-3.5 w-3.5 mr-1" />
                              Activate
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isPending}
                            onClick={() => handleOpenDeleteDialog(member)}
                            className="h-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                            title="Delete or Remove User"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <ScrollSentinel
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={fetchNextPage}
          loadedCount={members.length}
          totalItems={totalItems}
        />
      </div>

      {/* Invite/Create Member modal */}
      <InviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onUserInvited={handleUserInvited}
        activeCompanyId={activeCompanyId}
        companyName={company?.name}
        isSuperAdmin={role === "super_admin" || (systemRole || "").toLowerCase().includes("super")}
      />

      {/* Delete / Remove User Modal */}
      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        targetMember={deletingMember}
        members={members}
        activeCompanyId={activeCompanyId}
        currentUserId={currentProfile?.id}
        isSuperAdmin={role === "super_admin" || (systemRole || "").toLowerCase().includes("super")}
        onUserDeleted={handleUserDeleted}
      />

      {/* Reset Password Modal */}
      <ResetPasswordDialog
        open={!!resetPasswordUser}
        onOpenChange={(open) => !open && setResetPasswordUser(null)}
        user={resetPasswordUser}
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
                  <SelectItem value="Super Admin">Super Admin</SelectItem>
                  <SelectItem value="Company Admin">Company Admin</SelectItem>
                  <SelectItem value="Admin">Administrator</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Operator">Operator</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                  <SelectItem value="User">Basic User</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-normal">
                Super Admins and Company Admins have full privileges to manage roles, toggle activation, reset passwords, and configure access.
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

                  {/* Scheduled Date Range / Active Period */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Active Date Range (Optional)
                      </label>
                      {(editStartDate || editEndDate) && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditStartDate("");
                            setEditEndDate("");
                          }}
                          className="text-[10px] text-blue-500 hover:text-blue-600 hover:underline"
                        >
                          Clear Dates
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-medium text-slate-500 dark:text-slate-400">From Date</label>
                        <Input
                          type="date"
                          value={editStartDate}
                          onChange={(e) => setEditStartDate(e.target.value)}
                          className="h-9 rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-medium text-slate-500 dark:text-slate-400">To Date</label>
                        <Input
                          type="date"
                          value={editEndDate}
                          min={editStartDate || undefined}
                          onChange={(e) => setEditEndDate(e.target.value)}
                          className="h-9 rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                      Restrict access to a specific date or time period. Leave empty for ongoing access.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-850 pt-5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Module Access ({editModules.length}/{AVAILABLE_MODULES.length})
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditModules([...AVAILABLE_MODULES])}
                    className="text-xs font-semibold text-blue-500 hover:text-blue-600 hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <button
                    type="button"
                    onClick={() => setEditModules([])}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-600 hover:underline"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
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
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  const target = editingMember;
                  setEditingMember(null);
                  handleOpenDeleteDialog(target);
                }}
                className="rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1.5 font-semibold text-xs h-9"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete User
              </Button>
            </div>
            <div className="flex items-center gap-2">
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
