"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { UserData } from "@/types/user";
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
import { Loader2, Search, User as UserIcon, Shield, Activity, Edit2, CheckSquare, Save, X, ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePresence } from "@/components/presence-provider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { UserProfileCard } from "@/components/user-profile-card";


const AVAILABLE_MODULES = [
    "Field Assets",
    "Work Packages",
    "Planning",
    "Inspection",
    "Reports",
    "Library",
    "User Data",
    "Settings"
];

export function UserDataTable() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState("");
    const { onlineUserIds } = usePresence();
    const supabase = createClient();
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [localMetadata, setLocalMetadata] = useState<{
        full_name?: string;
        designation?: string;
        avatar_url?: string;
    } | null>(null);

    // Editing State
    const [editingUser, setEditingUser] = useState<UserData | null>(null);
    const [editRole, setEditRole] = useState<string>("");
    const [editModules, setEditModules] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [viewingUser, setViewingUser] = useState<UserData | null>(null);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Fetch user data
    const fetchUsers = async () => {
        try {
            setLoading(true);
            
            // Get current user and their local metadata (instantly available from session)
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                setCurrentUserId(authUser.id);
                setLocalMetadata(authUser.user_metadata);
            }

            const { data, error } = await supabase.rpc("get_all_users");

            if (error) throw error;
            setUsers(data || []);
        } catch (err: any) {
            console.error("Error fetching users:", err);
            setError(err.message || "Failed to load user data");
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        fetchUsers();

        // Listen for profile updates to refresh the list instantly
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'USER_UPDATED' || event === 'SIGNED_IN') {
                if (session?.user) {
                    setCurrentUserId(session.user.id);
                    setLocalMetadata(session.user.user_metadata);
                }
                fetchUsers();
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const filteredUsers = users.filter((user) =>
        user.email?.toLowerCase().includes(filter.toLowerCase())
    );

    const sortedUsers = [...filteredUsers].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;

        let aValue: any = a[key as keyof UserData];
        let bValue: any = b[key as keyof UserData];

        // Handle special display names for current user
        if (key === 'full_name') {
            aValue = getDisplayName(a);
            bValue = getDisplayName(b);
        }

        // Handle designation fallbacks
        if (key === 'designation') {
            aValue = (a.id === currentUserId && localMetadata?.designation) ? localMetadata.designation : (a.designation || "Offshore Staff");
            bValue = (b.id === currentUserId && localMetadata?.designation) ? localMetadata.designation : (b.designation || "Offshore Staff");
        }
        
        // Handle connection status sort
        if (key === 'connection') {
            aValue = isOnline(a) ? 1 : 0;
            bValue = isOnline(b) ? 1 : 0;
        }

        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        const result = aValue < bValue ? -1 : 1;
        return direction === 'asc' ? result : -result;
    });

    const currentUserData = users.find(u => u.id === currentUserId);
    const isAdmin = currentUserData?.role === 'Admin';

    const isOnline = (user: UserData) => {
        // 1. Check Real-time Presence set (Instant)
        if (onlineUserIds.has(user.id)) return true;

        // 2. Check Database Heartbeat (Fallback / Persistent)
        if (user.last_seen_at) {
            const lastSeenDate = new Date(user.last_seen_at);
            const now = new Date();
            const diffInSeconds = Math.abs(now.getTime() - lastSeenDate.getTime()) / 1000;
            
            // Increased threshold to 300s (5m) to account for clock drift or refresh delays
            if (diffInSeconds < 300) return true;
        }

        return false;
    };

    const getDisplayName = (user: UserData) => {
        const isMe = user.id === currentUserId;
        if (isMe && localMetadata?.full_name) return localMetadata.full_name;
        return user.full_name || user.email.split('@')[0];
    };

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
        setEditingUser(user);
        setEditRole(user.role || 'User');
        setEditModules(user.modules || []);
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
            const { data, error } = await supabase.rpc('assign_user_role', {
                target_id: editingUser.id,
                new_role: editRole,
                new_modules: editModules
            });

            if (error) throw error;
            if (data && !data.success) throw new Error(data.error || 'Failed to assign role');

            toast.success("User access updated successfully!");
            setEditingUser(null);
            fetchUsers(); // Refresh the list
        } catch (err: any) {
            console.error("Error saving role:", err);
            toast.error(err.message || "Failed to update role");
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
                <Button onClick={() => fetchUsers()} variant="outline" className="mt-4 border-red-200 text-red-700 hover:bg-red-100">
                    Retry Loading
                </Button>
            </div>
        );
    }

    const onlineCount = users.filter(user => isOnline(user)).length;

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
                            Monitoring {users.length} registered users
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
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <Label className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                Registered User Directory
                                {isAdmin && <Badge variant="default" className="bg-amber-500 text-white font-black text-[10px] uppercase shadow-sm">Admin View</Badge>}
                            </Label>
                            <p className="text-sm text-slate-500 mt-1">
                                Comprehensive list and connection status of all platform personnel
                            </p>
                        </div>
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                type="search"
                                placeholder="Search by email..."
                                className="pl-9 h-10 w-full bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500 shadow-sm rounded-lg font-medium"
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                                    <TableHead 
                                        className="font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-blue-600 transition-colors group"
                                        onClick={() => requestSort('full_name')}
                                    >
                                        <div className="flex items-center gap-2 uppercase tracking-tighter text-[11px]">
                                            User Identification
                                            {sortConfig?.key === 'full_name' ? (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                            ) : <ChevronUp className="h-3 w-3 opacity-0 group-hover:opacity-50" />}
                                        </div>
                                    </TableHead>
                                    <TableHead 
                                        className="font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-blue-600 transition-colors group"
                                        onClick={() => requestSort('designation')}
                                    >
                                        <div className="flex items-center gap-2 uppercase tracking-tighter text-[11px]">
                                            Designation
                                            {sortConfig?.key === 'designation' ? (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                            ) : <ChevronUp className="h-3 w-3 opacity-0 group-hover:opacity-50" />}
                                        </div>
                                    </TableHead>
                                    <TableHead 
                                        className="font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-blue-600 transition-colors group"
                                        onClick={() => requestSort('connection')}
                                    >
                                        <div className="flex items-center gap-2 uppercase tracking-tighter text-[11px]">
                                            Connection
                                            {sortConfig?.key === 'connection' ? (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                            ) : <ChevronUp className="h-3 w-3 opacity-0 group-hover:opacity-50" />}
                                        </div>
                                    </TableHead>
                                    <TableHead 
                                        className="font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-blue-600 transition-colors group"
                                        onClick={() => requestSort('role')}
                                    >
                                        <div className="flex items-center gap-2 uppercase tracking-tighter text-[11px]">
                                            Access Role
                                            {sortConfig?.key === 'role' ? (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                            ) : <ChevronUp className="h-3 w-3 opacity-0 group-hover:opacity-50" />}
                                        </div>
                                    </TableHead>
                                    <TableHead 
                                        className="font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-blue-600 transition-colors group"
                                        onClick={() => requestSort('created_at')}
                                    >
                                        <div className="flex items-center gap-2 uppercase tracking-tighter text-[11px]">
                                            Registered / Enrolled Date
                                            {sortConfig?.key === 'created_at' ? (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                            ) : <ChevronUp className="h-3 w-3 opacity-0 group-hover:opacity-50" />}
                                        </div>
                                    </TableHead>
                                    <TableHead 
                                        className="font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-blue-600 transition-colors group text-right pr-6"
                                        onClick={() => requestSort('last_seen_at')}
                                    >
                                        <div className="flex items-center justify-end gap-2 uppercase tracking-tighter text-[11px]">
                                            Last Active
                                            {sortConfig?.key === 'last_seen_at' ? (
                                                sortConfig.direction === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                            ) : <ChevronUp className="h-3 w-3 opacity-0 group-hover:opacity-50" />}
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
                                        const online = isOnline(user);
                                        const isMe = user.id === currentUserId;
                                        return (
                                            <TableRow
                                                key={user.id}
                                                className="hover:bg-slate-50 dark:hover:bg-slate-900/50 border-slate-200/60 dark:border-slate-800 transition-colors"
                                            >
                                                <TableCell className="font-medium p-4">
                                                    <div className="flex items-center gap-4">
                                                        <button 
                                                            onClick={() => setViewingUser(user)}
                                                            className="group relative focus:outline-none transition-transform active:scale-95"
                                                            title={`View ${getDisplayName(user)}'s profile`}
                                                        >
                                                            <div className="absolute inset-0 rounded-full bg-blue-500/20 scale-0 group-hover:scale-110 transition-transform duration-300" />
                                                            <Avatar className="h-14 w-14 border-2 border-white dark:border-slate-900 shadow-md ring-1 ring-slate-200 dark:ring-slate-800 transition-all group-hover:shadow-lg group-hover:ring-blue-400">
                                                                <AvatarImage 
                                                                    src={(user.id === currentUserId && localMetadata?.avatar_url) 
                                                                        ? localMetadata.avatar_url 
                                                                        : (user.avatar_url || "")} 
                                                                    className="object-cover" 
                                                                />
                                                                <AvatarFallback className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-700 dark:text-slate-300 font-black text-lg">
                                                                    {getInitials(user)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                        </button>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <button 
                                                                    onClick={() => setViewingUser(user)}
                                                                    className="text-sm font-black text-slate-900 dark:text-slate-100 hover:text-blue-600 transition-colors"
                                                                >
                                                                    {getDisplayName(user)}
                                                                </button>
                                                                {isMe && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 text-[9px] h-4 font-bold border-0 px-1.5 uppercase">You</Badge>}
                                                            </div>
                                                            <span className="text-[11px] text-slate-500 font-medium truncate max-w-[180px]">
                                                                {user.email}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                                            {user.id === currentUserId && localMetadata?.designation 
                                                                ? localMetadata.designation 
                                                                : (user.designation || "Offshore Staff")}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 uppercase tracking-tighter">
                                                            ID: {user.id.substring(0, 8)}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
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
                                                </TableCell>
                                                <TableCell className="text-slate-600 dark:text-slate-400 font-medium text-sm">
                                                    <div className="flex flex-col gap-1">
                                                        <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'} className={user.role === 'Admin' ? 'bg-amber-500 text-white w-max' : 'w-max'}>
                                                            {user.role || 'User'}
                                                        </Badge>
                                                        <span className="text-[10px] text-slate-400 truncate max-w-[150px]" title={user.modules?.join(", ")}>
                                                            {user.modules && user.modules.length > 0 ? `${user.modules.length} Modules Assigned` : 'No Modules'}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-slate-600 dark:text-slate-400 font-medium text-sm">
                                                    {user.created_at ? format(new Date(user.created_at), "dd MMM yyyy, HH:mm:ss") : "-"}
                                                </TableCell>
                                                <TableCell className="text-slate-500 dark:text-slate-400 font-medium text-sm text-right pr-6">
                                                    {online ? (
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
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleEditClick(user)}
                                                            className="text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mt-2 px-2">
                        <span>{filteredUsers.length} Users Listed</span>
                        <span>{onlineCount} Connected</span>
                    </div>
                </div>
            </Card>

            {/* Editing Dialog */}
            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-amber-500" />
                            Access Configuration
                        </DialogTitle>
                        <DialogDescription>
                            Change role and module permissions for {editingUser?.email}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">System Role</label>
                            <Select value={editRole} onValueChange={setEditRole}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Admin">Administrator</SelectItem>
                                    <SelectItem value="Operator">Operator</SelectItem>
                                    <SelectItem value="Viewer">Viewer</SelectItem>
                                    <SelectItem value="User">Basic User</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-muted-foreground mt-1 mb-4">Admins have full access to manage roles. Other roles are for categorizing access.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Module Access</label>
                            <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800">
                                {AVAILABLE_MODULES.map((mod) => (
                                    <div key={mod} className="flex flex-row items-center space-x-2 py-1">
                                        <Checkbox
                                            id={`mod-${mod}`}
                                            checked={editModules.includes(mod)}
                                            onCheckedChange={() => handleModuleToggle(mod)}
                                        />
                                        <label
                                            htmlFor={`mod-${mod}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-slate-700 dark:text-slate-300"
                                        >
                                            {mod}
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="sm:justify-between border-t border-slate-100 pt-3">
                        <Button type="button" variant="ghost" onClick={() => setEditingUser(null)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSaving}
                            onClick={handleSaveRole}
                            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save Configuration
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Profile View Dialog */}
            <Dialog open={!!viewingUser} onOpenChange={(open) => !open && setViewingUser(null)}>
                <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-0 bg-white dark:bg-slate-950 rounded-3xl shadow-2xl ring-1 ring-slate-200 dark:ring-slate-800">
                    {viewingUser && (
                        <UserProfileCard 
                            user={viewingUser} 
                            isOnline={isOnline(viewingUser)} 
                            isMe={viewingUser.id === currentUserId}
                            currentUserMetadata={localMetadata}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Simple label component
function Label({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <label className={className}>
            {children}
        </label>
    );
}
