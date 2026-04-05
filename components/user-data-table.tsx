"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
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
import { Loader2, Search, User as UserIcon, Shield, Activity, Edit2, CheckSquare, Save, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePresence } from "@/components/presence-provider";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

// Defined locally to match the updated RPC return type
type UserData = {
    id: string;
    email: string;
    last_sign_in_at: string | null;
    created_at: string;
    role: string;
    modules: string[];
};

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

    // Editing State
    const [editingUser, setEditingUser] = useState<UserData | null>(null);
    const [editRole, setEditRole] = useState<string>("");
    const [editModules, setEditModules] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch user data
    const fetchUsers = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) setCurrentUserId(session.user.id);

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
    }, []);

    const filteredUsers = users.filter((user) =>
        user.email?.toLowerCase().includes(filter.toLowerCase())
    );

    const currentUserData = users.find(u => u.id === currentUserId);
    const isAdmin = currentUserData?.role === 'Admin';

    const isOnline = (user: UserData) => {
        // Real-time presence check
        if (onlineUserIds.has(user.id)) return true;

        // Fallback: Show online for the last hour to be generous for demo
        if (!user.last_sign_in_at) return false;
        const date = parseISO(user.last_sign_in_at);
        const now = new Date();
        const diffInMinutes = (now.getTime() - date.getTime()) / 1000 / 60;
        return diffInMinutes < 60;
    };

    const getInitials = (email: string) => {
        if (!email) return "U";
        return email.substring(0, 2).toUpperCase();
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
                                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400">User Identification</TableHead>
                                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 w-32">Connection</TableHead>
                                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Access Role</TableHead>
                                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Account Created</TableHead>
                                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-right pr-6">Last Active</TableHead>
                                    {isAdmin && <TableHead className="w-16"></TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={isAdmin ? 5 : 4} className="h-32 text-center text-slate-500 font-medium">
                                            No user accounts match your search criteria.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((user) => {
                                        const online = isOnline(user);
                                        const isMe = user.id === currentUserId;
                                        return (
                                            <TableRow
                                                key={user.id}
                                                className="hover:bg-slate-50 dark:hover:bg-slate-900/50 border-slate-200/60 dark:border-slate-800 transition-colors"
                                            >
                                                <TableCell className="font-medium p-4">
                                                    <div className="flex items-center gap-4">
                                                        <Avatar className="h-10 w-10 border-2 border-white dark:border-slate-900 shadow-sm">
                                                            <AvatarImage src="" />
                                                            <AvatarFallback className="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                                                                {getInitials(user.email)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{user.email}</span>
                                                                {isMe && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 text-[9px] h-4 font-bold border-0 px-1.5 uppercase">You</Badge>}
                                                            </div>
                                                            <span className="text-xs text-slate-500 font-mono mt-0.5 uppercase tracking-wider">
                                                                ID: {user.id.substring(0, 8)}...
                                                            </span>
                                                        </div>
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
                                                    {user.created_at ? format(parseISO(user.created_at), "dd MMM yyyy, hh:mm a") : "-"}
                                                </TableCell>
                                                <TableCell className="text-slate-500 dark:text-slate-400 font-medium text-sm text-right pr-6">
                                                    {online ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <span className="text-green-600 dark:text-green-400 font-semibold">Right now</span>
                                                            {user.last_sign_in_at && (
                                                                <span className="text-[10px] text-slate-400">Since {format(parseISO(user.last_sign_in_at), "hh:mm a")}</span>
                                                            )}
                                                        </div>
                                                    ) : user.last_sign_in_at ? (
                                                        <span>
                                                            {format(parseISO(user.last_sign_in_at), "dd MMM yyyy, hh:mm a")}
                                                        </span>
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
