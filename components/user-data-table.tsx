"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { UserData } from "@/types/user";
import { useUserProfile } from "@/components/user-profile-provider";
import { useUserRole } from "@/utils/hooks/use-user-role";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow, parseISO, format } from "date-fns";
import { Loader2, Search, User as UserIcon, Shield, Activity, Edit2, CheckSquare, Save, X, ChevronUp, ChevronDown, KeyRound, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { usePresence } from "@/components/presence-provider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { UserProfileCard } from "@/components/user-profile-card";
import { ResetPasswordDialog } from "@/components/admin/reset-password-dialog";
import { useInfiniteList } from "@/hooks/use-infinite-list";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ScrollSentinel } from "@/components/data-table/scroll-sentinel";


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

export function UserDataTable() {
    const [filter, setFilter] = useState("");
    const debouncedFilter = useDebouncedValue(filter, 300);
    const { onlineUserIds } = usePresence();
    const supabase = useMemo(() => createClient(), []);

    const { profile, user: authUser } = useUserProfile();
    const { activeCompanyId, isAdmin: isContextAdmin, role: effectiveRole, systemRole } = useUserRole();

    const currentUserId = profile?.id || authUser?.id || null;
    const localMetadata = profile ? {
        full_name: profile.full_name || undefined,
        designation: profile.designation || undefined,
        avatar_url: profile.avatar_url || undefined,
    } : null;

    // Scroll-to-load user directory. The server pages the get_all_users RPC
    // (50 rows at a time) and handles the search server-side via ?q=.
    const {
        items: users,
        totalItems,
        isLoading: loading,
        error,
        hasNextPage,
        isFetchingNextPage,
        fetchNextPage,
        refetch,
        updateItem,
    } = useInfiniteList<UserData>({
        queryKey: ["users", "directory", debouncedFilter, activeCompanyId],
        getPageUrl: (page) =>
            `/api/users?page=${page}&pageSize=50${
                debouncedFilter ? `&q=${encodeURIComponent(debouncedFilter)}` : ""
            }`,
        getHeaders: () =>
            activeCompanyId ? { "x-company-id": activeCompanyId } : ({} as Record<string, string>),
    });

    // Editing State
    const [editingUser, setEditingUser] = useState<UserData | null>(null);
    const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; email?: string; full_name?: string } | null>(null);
    const [editFullName, setEditFullName] = useState<string>("");
    const [editDesignation, setEditDesignation] = useState<string>("");
    const [editRole, setEditRole] = useState<string>("");
    const [editModules, setEditModules] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [viewingUser, setViewingUser] = useState<UserData | null>(null);

    const currentUserData = users.find(u => u.id === currentUserId);
    const sysRoleStr = (systemRole || "").toLowerCase();
    const isSuperOrAdmin =
        isContextAdmin ||
        effectiveRole === "super_admin" ||
        effectiveRole === "company_admin" ||
        sysRoleStr.includes("admin") ||
        currentUserData?.role === 'Admin';
    const isAdmin = Boolean(isSuperOrAdmin);

    const isHeartbeatOnline = useCallback((user: UserData) => {
        if (!user.last_seen_at) return false;
        const lastSeenDate = new Date(user.last_seen_at);
        const now = new Date();
        const diffInSeconds = Math.abs(now.getTime() - lastSeenDate.getTime()) / 1000;
        // Increased threshold to 300s (5m) to account for clock drift or refresh delays
        return diffInSeconds < 300;
    }, []);

    const isOnline = useCallback((user: UserData) => {
        if (user.id === currentUserId) return true;
        if (user.is_active === false && user.role !== 'Admin') return false;
        // 1. Check Real-time Presence set (Instant)
        if (onlineUserIds.has(user.id)) return true;

        // 2. Check Database Heartbeat (Fallback / Persistent)
        return isHeartbeatOnline(user);
    }, [onlineUserIds, isHeartbeatOnline, currentUserId]);

    const getDisplayName = useCallback((user: UserData) => {
        const isMe = user.id === currentUserId;
        if (isMe && localMetadata?.full_name) return localMetadata.full_name;
        return user.full_name || user.email.split('@')[0];
    }, [currentUserId, localMetadata?.full_name]);

    const requestSort = (key: string) => {
        setSortConfig((prev) => {
            if (prev?.key !== key) {
                return { key, direction: "asc" };
            }
            if (prev.direction === "asc") {
                return { key, direction: "desc" };
            }
            // 3rd click clears the sort back to default order
            return null;
        });
    };

    const renderSortIcon = (key: string) => {
        if (sortConfig?.key !== key) {
            return (
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-400/50 group-hover:text-blue-500 transition-colors shrink-0 ml-1" />
            );
        }
        return sortConfig.direction === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 font-bold shrink-0 ml-1" />
        ) : (
            <ArrowDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 font-bold shrink-0 ml-1" />
        );
    };

    const sortedUsers = useMemo(() => {
        if (!sortConfig) return users;
        const { key, direction } = sortConfig;

        return [...users].sort((a, b) => {
            let aVal: any = "";
            let bVal: any = "";

            if (key === "full_name") {
                aVal = getDisplayName(a).toLowerCase();
                bVal = getDisplayName(b).toLowerCase();
            } else if (key === "designation") {
                aVal = ((a.id === currentUserId && localMetadata?.designation) ? localMetadata.designation : (a.designation || "Offshore Staff")).toLowerCase();
                bVal = ((b.id === currentUserId && localMetadata?.designation) ? localMetadata.designation : (b.designation || "Offshore Staff")).toLowerCase();
            } else if (key === "connection") {
                const getStatusScore = (u: UserData) => {
                    const isMe = u.id === currentUserId;
                    if (u.is_active === false && !isMe) return 0;
                    return isOnline(u) ? 2 : 1;
                };
                const aScore = getStatusScore(a);
                const bScore = getStatusScore(b);
                if (aScore !== bScore) {
                    return direction === "asc" ? bScore - aScore : aScore - bScore;
                }
                return getDisplayName(a).localeCompare(getDisplayName(b));
            } else if (key === "role") {
                aVal = (a.role || "User").toLowerCase();
                bVal = (b.role || "User").toLowerCase();
            } else if (key === "created_at") {
                const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return direction === "asc" ? timeA - timeB : timeB - timeA;
            } else if (key === "last_seen_at") {
                const aOnline = isOnline(a);
                const bOnline = isOnline(b);
                const timeA = aOnline ? Date.now() : (a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0);
                const timeB = bOnline ? Date.now() : (b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0);
                return direction === "asc" ? timeA - timeB : timeB - timeA;
            } else {
                aVal = String(a[key as keyof UserData] || "").toLowerCase();
                bVal = String(b[key as keyof UserData] || "").toLowerCase();
            }

            const comp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
            return direction === "asc" ? comp : -comp;
        });
    }, [users, sortConfig, currentUserId, localMetadata, getDisplayName, isOnline]);

    const getInitials = (user: UserData) => {
        const isMe = user.id === currentUserId;
        const fullName = (isMe && localMetadata?.full_name) ? localMetadata.full_name : user.full_name;
        
        if (fullName) {
            const parts = fullName.split(' ');
            if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
            return fullName.substring(0, 2).toUpperCase();
        }
        return user.email.substring(0, 2).toUpperCase();
    };

    const handleEditClick = (user: UserData) => {
        const isMe = user.id === currentUserId;
        if (user.is_active === false && !isMe) {
            toast.error("This account is deactivated. Reactivate in User Administration to edit properties.");
            return;
        }
        setEditingUser(user);
        setEditFullName(user.full_name || "");
        setEditDesignation(user.designation || "Offshore Staff");
        setEditRole(user.role || 'User');
        setEditModules(user.modules || []);
    };

    const handleResetPasswordClick = (user: UserData) => {
        const isMe = user.id === currentUserId;
        if (user.is_active === false && !isMe) {
            toast.error("This account is deactivated. Password changes are not permitted.");
            return;
        }
        setResetPasswordUser({
            id: user.id,
            email: user.email,
            full_name: getDisplayName(user),
        });
    };

    const handleSelectAllModules = () => {
        setEditModules([...AVAILABLE_MODULES]);
    };

    const handleClearAllModules = () => {
        setEditModules([]);
    };

    const handleModuleToggle = (moduleName: string) => {
        setEditModules(prev =>
            prev.includes(moduleName)
                ? prev.filter(m => m !== moduleName)
                : [...prev, moduleName]
        );
    };

    const handleSaveRole = async () => {
        if (!editingUser) return;
        setIsSaving(true);
        try {
            // 1. Update profiles table (full_name, designation)
            const { error: profileError } = await supabase
                .from("profiles")
                .update({
                    full_name: editFullName.trim() || null,
                    designation: editDesignation.trim() || null,
                    updated_at: new Date().toISOString()
                })
                .eq("id", editingUser.id);

            if (profileError) {
                console.warn("Profiles update notice:", profileError.message);
            }

            // 2. Update role and modules via assign_user_role RPC
            const { data, error } = await supabase.rpc('assign_user_role', {
                target_id: editingUser.id,
                new_role: editRole,
                new_modules: editModules
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.error || 'Failed to assign role');

            // 3. Optimistic update in infinite query list
            updateItem((u) => u.id === editingUser.id ? {
                ...u,
                full_name: editFullName.trim() || u.full_name,
                designation: editDesignation.trim() || u.designation,
                role: editRole,
                modules: editModules,
            } : u);

            toast.success("User profile and permissions updated successfully!");
            setEditingUser(null);
            refetch(); // Refresh the loaded window
        } catch (err: any) {
            console.error("Error saving user profile:", err);
            toast.error(err.message || "Failed to update user profile");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!editingUser) return;
        if (editingUser.id === currentUserId) {
            toast.error("You cannot delete your own account.");
            return;
        }
        if (!confirm(`Are you sure you want to permanently delete user "${editingUser.full_name || editingUser.email}"? This will revoke all company access and delete credentials.`)) {
            return;
        }

        setIsSaving(true);
        try {
            const res = await fetch(`/api/admin/users/${editingUser.id}?hard=true`, {
                method: "DELETE",
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || json.success === false) {
                throw new Error(json.error || "Failed to delete user");
            }
            toast.success("User deleted successfully.");
            setEditingUser(null);
            refetch();
        } catch (err: any) {
            console.error("Error deleting user:", err);
            toast.error(err.message || "Failed to delete user");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600 dark:text-blue-400" />
                    <p className="text-sm font-medium text-slate-500 animate-pulse">Loading user activity data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 border border-red-200 bg-red-50 text-red-700 rounded-2xl shadow-sm dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400 ml-2">
                <div className="flex items-center gap-3 mb-2">
                    <Shield className="h-6 w-6" />
                    <h3 className="font-black text-lg">Error Loading Data</h3>
                </div>
                <p className="font-medium text-sm">{error}</p>
                <p className="text-xs mt-3 opacity-80 uppercase tracking-wider font-semibold">
                    Note: The 'get_all_users' RPC function in Supabase may be missing or inaccessible. Ensure `setup_user_roles.sql` and the RPC migrations were executed.
                </p>
                <Button onClick={() => refetch()} variant="outline" className="mt-4 border-red-200 text-red-700 hover:bg-red-100">
                    Retry Loading
                </Button>
            </div>
        );
    }

    // Presence covers every online user app-wide; the heartbeat check only
    // reaches users inside the currently loaded window.
    const onlineCount =
        onlineUserIds.size +
        users.filter((user) => !onlineUserIds.has(user.id) && isHeartbeatOnline(user)).length;

    return (
        <div className="space-y-6">
            {/* Realtime Status Banner */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 shadow-sm transition-all animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                    <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-100 uppercase tracking-wider mb-0.5">
                            Real-time Presence
                        </p>
                        <p className="text-[13px] font-medium text-blue-700 dark:text-blue-300">
                            Monitoring {totalItems ?? users.length} registered users
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 border-l border-blue-200 dark:border-blue-800/50 pl-4">
                    <div className="text-right">
                        <div className="text-2xl font-black text-blue-700 dark:text-blue-400 leading-none">{onlineCount}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70 mt-1">Online Now</div>
                    </div>
                </div>
            </div>

            <Card className="p-1 shadow-xl border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden rounded-2xl">
                <div className="bg-slate-50/50 dark:bg-slate-900/50 p-6 space-y-6 rounded-xl">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <Label className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                Registered User Directory
                                {isAdmin && <Badge variant="default" className="bg-amber-500 text-white font-black text-[10px] uppercase shadow-sm">Admin View</Badge>}
                            </Label>
                            <p className="text-sm text-slate-500 mt-1">
                                Comprehensive list and connection status of all platform personnel
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    type="search"
                                    placeholder="Search by email..."
                                    className="pl-9 h-10 w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 shadow-sm rounded-lg font-medium"
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                />
                            </div>

                            {/* Column Sort Dropdown & Toggle */}
                            <div className="flex items-center gap-1.5 shrink-0">
                                <Select
                                    value={sortConfig?.key || "default"}
                                    onValueChange={(val) => {
                                        if (val === "default") {
                                            setSortConfig(null);
                                        } else {
                                            setSortConfig((prev) => ({
                                                key: val,
                                                direction: prev?.key === val ? prev.direction : "asc",
                                            }));
                                        }
                                    }}
                                >
                                    <SelectTrigger className="h-10 px-3 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs font-bold rounded-lg shadow-sm gap-2 min-w-[170px]">
                                        <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <SelectValue placeholder="Sort by column..." />
                                    </SelectTrigger>
                                    <SelectContent align="end" className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                                        <SelectItem value="default" className="text-xs font-medium">Default Order</SelectItem>
                                        <SelectItem value="full_name" className="text-xs font-medium">User Identification</SelectItem>
                                        <SelectItem value="designation" className="text-xs font-medium">Designation</SelectItem>
                                        <SelectItem value="connection" className="text-xs font-medium">Connection Status</SelectItem>
                                        <SelectItem value="role" className="text-xs font-medium">Access Role</SelectItem>
                                        <SelectItem value="created_at" className="text-xs font-medium">Registered / Enrolled Date</SelectItem>
                                        <SelectItem value="last_seen_at" className="text-xs font-medium">Last Active Time</SelectItem>
                                    </SelectContent>
                                </Select>

                                {sortConfig && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() =>
                                            setSortConfig((prev) =>
                                                prev
                                                    ? { ...prev, direction: prev.direction === "asc" ? "desc" : "asc" }
                                                    : null
                                            )
                                        }
                                        className="h-10 w-10 shrink-0 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-blue-600 dark:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-lg shadow-sm"
                                        title={`Sorting ${sortConfig.direction === "asc" ? "Ascending (A-Z / Oldest)" : "Descending (Z-A / Newest)"}. Click to switch direction.`}
                                    >
                                        {sortConfig.direction === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                                    <TableHead 
                                        className={cn(
                                            "font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-blue-600 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors group select-none py-3.5",
                                            sortConfig?.key === 'full_name' && "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                                        )}
                                        onClick={() => requestSort('full_name')}
                                        title={`Sort by User Identification (${sortConfig?.key === 'full_name' && sortConfig.direction === 'asc' ? 'Descending' : 'Ascending'})`}
                                    >
                                        <div className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] font-black">
                                            <span>User Identification</span>
                                            {renderSortIcon('full_name')}
                                        </div>
                                    </TableHead>
                                    <TableHead 
                                        className={cn(
                                            "font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-blue-600 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors group select-none py-3.5",
                                            sortConfig?.key === 'designation' && "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                                        )}
                                        onClick={() => requestSort('designation')}
                                        title={`Sort by Designation (${sortConfig?.key === 'designation' && sortConfig.direction === 'asc' ? 'Descending' : 'Ascending'})`}
                                    >
                                        <div className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] font-black">
                                            <span>Designation</span>
                                            {renderSortIcon('designation')}
                                        </div>
                                    </TableHead>
                                    <TableHead 
                                        className={cn(
                                            "font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-blue-600 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors group select-none py-3.5",
                                            sortConfig?.key === 'connection' && "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                                        )}
                                        onClick={() => requestSort('connection')}
                                        title={`Sort by Connection (${sortConfig?.key === 'connection' && sortConfig.direction === 'asc' ? 'Descending' : 'Ascending'})`}
                                    >
                                        <div className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] font-black">
                                            <span>Connection</span>
                                            {renderSortIcon('connection')}
                                        </div>
                                    </TableHead>
                                    <TableHead 
                                        className={cn(
                                            "font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-blue-600 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors group select-none py-3.5",
                                            sortConfig?.key === 'role' && "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                                        )}
                                        onClick={() => requestSort('role')}
                                        title={`Sort by Access Role (${sortConfig?.key === 'role' && sortConfig.direction === 'asc' ? 'Descending' : 'Ascending'})`}
                                    >
                                        <div className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] font-black">
                                            <span>Access Role</span>
                                            {renderSortIcon('role')}
                                        </div>
                                    </TableHead>
                                    <TableHead 
                                        className={cn(
                                            "font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-blue-600 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors group select-none py-3.5",
                                            sortConfig?.key === 'created_at' && "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                                        )}
                                        onClick={() => requestSort('created_at')}
                                        title={`Sort by Registered / Enrolled Date (${sortConfig?.key === 'created_at' && sortConfig.direction === 'asc' ? 'Descending' : 'Ascending'})`}
                                    >
                                        <div className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] font-black">
                                            <span>Registered / Enrolled Date</span>
                                            {renderSortIcon('created_at')}
                                        </div>
                                    </TableHead>
                                    <TableHead 
                                        className={cn(
                                            "font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-blue-600 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors group select-none text-right pr-6 py-3.5",
                                            sortConfig?.key === 'last_seen_at' && "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20"
                                        )}
                                        onClick={() => requestSort('last_seen_at')}
                                        title={`Sort by Last Active (${sortConfig?.key === 'last_seen_at' && sortConfig.direction === 'asc' ? 'Descending' : 'Ascending'})`}
                                    >
                                        <div className="flex items-center justify-end gap-1.5 uppercase tracking-wider text-[11px] font-black">
                                            <span>Last Active</span>
                                            {renderSortIcon('last_seen_at')}
                                        </div>
                                    </TableHead>
                                    {isAdmin && <TableHead className="w-16"></TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={isAdmin ? 7 : 6} className="h-32 text-center text-slate-500 font-medium">
                                            No user accounts match your search criteria.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedUsers.map((user) => {
                                        const isMe = user.id === currentUserId;
                                        const isDeactivated = user.is_active === false && !isMe;
                                        const online = isOnline(user);
                                        return (
                                            <TableRow
                                                key={user.id}
                                                className={cn(
                                                    "transition-colors",
                                                    isDeactivated 
                                                        ? "bg-rose-100/70 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/60 border-rose-300 dark:border-rose-800 border-l-4 border-l-rose-500 shadow-sm" 
                                                        : "hover:bg-slate-50 dark:hover:bg-slate-900/50 border-slate-200/60 dark:border-slate-800"
                                                )}
                                            >
                                                <TableCell className="font-medium p-4">
                                                    <div className="flex items-center gap-4">
                                                        <button 
                                                            onClick={() => setViewingUser(user)}
                                                            className="group relative focus:outline-none transition-transform active:scale-95"
                                                            title={`View ${getDisplayName(user)}'s profile`}
                                                        >
                                                            <div className="absolute inset-0 rounded-full bg-blue-500/20 scale-0 group-hover:scale-110 transition-transform duration-300" />
                                                            <Avatar className={cn(
                                                                "h-14 w-14 border-2 border-white dark:border-slate-900 shadow-md ring-1 transition-all group-hover:shadow-lg",
                                                                isDeactivated 
                                                                    ? "ring-rose-400 dark:ring-rose-800 opacity-80 grayscale-[25%]" 
                                                                    : "ring-slate-200 dark:ring-slate-800 group-hover:ring-blue-400"
                                                            )}>
                                                                <AvatarImage 
                                                                    src={(user.id === currentUserId && localMetadata?.avatar_url) 
                                                                        ? localMetadata.avatar_url 
                                                                        : (user.avatar_url || "")} 
                                                                    className="object-cover" 
                                                                />
                                                                <AvatarFallback className={cn(
                                                                    "font-black text-lg",
                                                                    isDeactivated 
                                                                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" 
                                                                        : "bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-700 dark:text-slate-300"
                                                                )}>
                                                                    {getInitials(user)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        </button>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <button 
                                                                    onClick={() => setViewingUser(user)}
                                                                    className={cn(
                                                                        "text-sm font-black transition-colors text-left",
                                                                        isDeactivated 
                                                                            ? "text-rose-700 dark:text-rose-300 hover:text-rose-800" 
                                                                            : "text-slate-900 dark:text-slate-100 hover:text-blue-600"
                                                                    )}
                                                                >
                                                                    {getDisplayName(user)}
                                                                </button>
                                                                {isMe && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 text-[9px] h-4 font-bold border-0 px-1.5 uppercase">You</Badge>}
                                                                {isDeactivated && (
                                                                    <Badge variant="outline" className="bg-rose-100/90 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border-rose-300 dark:border-rose-800 text-[9px] h-4 font-black uppercase tracking-wider px-1.5 shadow-sm">
                                                                        Inactive
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <span className="text-[11px] text-slate-500 font-medium truncate max-w-[180px]">
                                                                {user.email}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className={cn(
                                                            "text-sm font-bold",
                                                            isDeactivated ? "text-rose-900 dark:text-rose-200" : "text-slate-700 dark:text-slate-300"
                                                        )}>
                                                            {user.id === currentUserId && localMetadata?.designation 
                                                                ? localMetadata.designation 
                                                                : (user.designation || "Offshore Staff")}
                                                        </span>
                                                        <span className={cn(
                                                            "text-[10px] uppercase tracking-tighter font-semibold",
                                                            isDeactivated ? "text-rose-600 dark:text-rose-400 font-bold" : "text-slate-400"
                                                        )}>
                                                            ID: {user.id.substring(0, 8)}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {isDeactivated ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="gap-1.5 px-2.5 py-1 bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-950/70 dark:text-rose-400 dark:border-rose-800 font-bold"
                                                        >
                                                            <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0 shadow-[0_0_6px_rgba(244,63,94,0.6)]" />
                                                            <span className="font-bold text-xs uppercase tracking-wider">
                                                                Inactive
                                                            </span>
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="outline"
                                                            className={`gap-1.5 px-2.5 py-1 ${online
                                                                ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20"
                                                                : "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"}`}
                                                        >
                                                            <span
                                                                className={`h-2 w-2 rounded-full ${online
                                                                    ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                                                                    : "bg-slate-400 dark:bg-slate-500"
                                                                    }`}
                                                            />
                                                            <span className="font-semibold text-xs uppercase tracking-wider">
                                                                {online ? "Online" : "Offline"}
                                                            </span>
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-slate-600 dark:text-slate-400 font-medium text-sm">
                                                    <div className="flex flex-col gap-1">
                                                        <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'} className={cn(
                                                            user.role === 'Admin' ? 'bg-amber-500 text-white w-max' : 'w-max',
                                                            isDeactivated && "opacity-60"
                                                        )}>
                                                            {user.role || 'User'}
                                                        </Badge>
                                                        <span className={cn(
                                                            "text-[10px] truncate max-w-[150px]",
                                                            isDeactivated ? "text-rose-600/80 dark:text-rose-400/80 font-medium" : "text-slate-400"
                                                        )} title={user.modules?.join(", ")}>
                                                            {isDeactivated 
                                                                ? "Access Suspended" 
                                                                : (user.modules && user.modules.length > 0 ? `${user.modules.length} Modules Assigned` : 'No Modules')}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-slate-600 dark:text-slate-400 font-medium text-sm">
                                                    {user.created_at ? format(new Date(user.created_at), "dd MMM yyyy, HH:mm:ss") : "-"}
                                                </TableCell>
                                                <TableCell className="text-slate-500 dark:text-slate-400 font-medium text-sm text-right pr-6">
                                                    {isDeactivated ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="text-rose-600 dark:text-rose-400 font-semibold text-xs">Account Inactive</span>
                                                            <span className="text-[10px] text-slate-400">
                                                                {user.last_seen_at 
                                                                    ? `Last seen ${format(new Date(user.last_seen_at), "dd MMM yyyy")}` 
                                                                    : "Access suspended"}
                                                            </span>
                                                        </div>
                                                    ) : online ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="text-green-600 dark:text-green-400 font-semibold">Right now</span>
                                                            <span className="text-[10px] text-slate-400">Activity detected</span>
                                                        </div>
                                                    ) : user.last_seen_at ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span>{format(new Date(user.last_seen_at), "dd MMM yyyy, HH:mm:ss")}</span>
                                                            <span className="text-[10px] text-slate-400">Last activity</span>
                                                        </div>
                                                    ) : user.last_sign_in_at ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span>{format(new Date(user.last_sign_in_at), "dd MMM yyyy, HH:mm:ss")}</span>
                                                            <span className="text-[10px] text-slate-400">Last sign in</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic">Never</span>
                                                    )}
                                                </TableCell>
                                                {isAdmin && (
                                                    <TableCell className="text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                disabled={isDeactivated}
                                                                onClick={() => handleResetPasswordClick(user)}
                                                                className={cn(
                                                                    "transition-colors",
                                                                    isDeactivated 
                                                                        ? "cursor-not-allowed opacity-30 text-slate-300 dark:text-slate-600 hover:bg-transparent hover:text-slate-300" 
                                                                        : "text-slate-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30"
                                                                )}
                                                                title={isDeactivated ? "Account is deactivated. Password changes are not permitted." : "Reset Password & Set One-Time Password"}
                                                            >
                                                                <KeyRound className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                disabled={isDeactivated}
                                                                onClick={() => handleEditClick(user)}
                                                                className={cn(
                                                                    "transition-colors",
                                                                    isDeactivated 
                                                                        ? "cursor-not-allowed opacity-30 text-slate-300 dark:text-slate-600 hover:bg-transparent hover:text-slate-300" 
                                                                        : "text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30"
                                                                )}
                                                                title={isDeactivated ? "Account is deactivated. Access properties cannot be modified." : "Edit Profile & Permissions"}
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <ScrollSentinel
                        hasNextPage={hasNextPage}
                        isFetchingNextPage={isFetchingNextPage}
                        onLoadMore={fetchNextPage}
                        loadedCount={users.length}
                        totalItems={totalItems}
                        hideWhenDone={false}
                    />

                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mt-2 px-2">
                        <span>{totalItems ?? users.length} Users Listed</span>
                        <span>{onlineCount} Connected</span>
                    </div>
                </div>
            </Card>

            {/* Editing Dialog */}
            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                            <Shield className="h-5 w-5 text-amber-500" />
                            Edit Profile & Permissions
                        </DialogTitle>
                        <DialogDescription>
                            Update user profile details, role, and module permissions for {editingUser?.email}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* Profile Info Section */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</label>
                                <Input
                                    value={editFullName}
                                    onChange={(e) => setEditFullName(e.target.value)}
                                    placeholder="e.g. John Doe"
                                    className="h-9 bg-white dark:bg-slate-950 font-medium"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Designation</label>
                                <Input
                                    value={editDesignation}
                                    onChange={(e) => setEditDesignation(e.target.value)}
                                    placeholder="e.g. Senior Inspection Engineer"
                                    className="h-9 bg-white dark:bg-slate-950 font-medium"
                                />
                            </div>
                        </div>

                        {/* System Role Selection */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">System Role</label>
                            <Select value={editRole} onValueChange={setEditRole}>
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Super Admin">Super Admin</SelectItem>
                                    <SelectItem value="Company Admin">Company Admin</SelectItem>
                                    <SelectItem value="Admin">Administrator</SelectItem>
                                    <SelectItem value="Operator">Operator</SelectItem>
                                    <SelectItem value="Viewer">Viewer</SelectItem>
                                    <SelectItem value="User">Basic User</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-muted-foreground">
                                Super Admin & Company Admin grant administrative oversight. Operator & Viewer categorize functional access.
                            </p>
                        </div>

                        {/* Module Access Checkboxes */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Module Access ({editModules.length}/{AVAILABLE_MODULES.length})
                                </label>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSelectAllModules}
                                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                                    >
                                        Select All
                                    </button>
                                    <span className="text-slate-300 dark:text-slate-700">|</span>
                                    <button
                                        type="button"
                                        onClick={handleClearAllModules}
                                        className="text-[11px] text-slate-500 hover:underline font-semibold"
                                    >
                                        Clear All
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-h-56 overflow-y-auto">
                                {AVAILABLE_MODULES.map((mod) => (
                                    <div key={mod} className="flex flex-row items-center space-x-2 py-1">
                                        <Checkbox
                                            id={`mod-${mod}`}
                                            checked={editModules.includes(mod)}
                                            onCheckedChange={() => handleModuleToggle(mod)}
                                        />
                                        <label
                                            htmlFor={`mod-${mod}`}
                                            className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-slate-700 dark:text-slate-300 select-none"
                                        >
                                            {mod}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="sm:justify-between border-t border-slate-100 dark:border-slate-800 pt-3">
                        {isContextAdmin && editingUser?.id !== currentUserId ? (
                            <Button
                                type="button"
                                variant="ghost"
                                disabled={isSaving}
                                onClick={handleDeleteUser}
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1.5 font-semibold text-xs h-9"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete User
                            </Button>
                        ) : (
                            <div />
                        )}
                        <div className="flex items-center gap-2">
                            <Button type="button" variant="ghost" onClick={() => setEditingUser(null)}>
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                disabled={isSaving}
                                onClick={handleSaveRole}
                                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold shadow-sm"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Save Changes
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Profile View Dialog */}
            <Dialog open={!!viewingUser} onOpenChange={(open) => !open && setViewingUser(null)}>
                <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-0 bg-white dark:bg-slate-950 rounded-3xl shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800">
                    <DialogHeader className="sr-only">
                        <DialogTitle>User Profile</DialogTitle>
                        <DialogDescription>
                            Viewing detailed profile for {viewingUser ? getDisplayName(viewingUser) : 'user'}
                        </DialogDescription>
                    </DialogHeader>
                    {viewingUser && (
                        <UserProfileCard 
                            user={viewingUser} 
                            isOnline={isOnline(viewingUser)} 
                            isMe={viewingUser.id === currentUserId}
                            currentUserMetadata={localMetadata}
                            canEdit={isAdmin && (viewingUser.is_active !== false || viewingUser.id === currentUserId)}
                            onEdit={() => {
                                const isSelf = viewingUser.id === currentUserId;
                                if (viewingUser.is_active === false && !isSelf) {
                                    toast.error("This account is deactivated. Reactivate in User Administration to edit properties.");
                                    return;
                                }
                                const targetUser = viewingUser;
                                setViewingUser(null);
                                handleEditClick(targetUser);
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Reset Password Modal */}
            <ResetPasswordDialog
                open={!!resetPasswordUser}
                onOpenChange={(open) => !open && setResetPasswordUser(null)}
                user={resetPasswordUser}
            />
        </div>
    );
}
