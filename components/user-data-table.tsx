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
import { formatDistanceToNow, parseISO } from "date-fns";
import { Loader2, Search, User as UserIcon, Shield, Activity } from "lucide-react";
import { Input } from "@/components/ui/input";

import { usePresence } from "@/components/presence-provider";

// Defined locally to match the RPC return type
type UserData = {
    id: string;
    email: string;
    last_sign_in_at: string | null;
    created_at: string;
};

export function UserDataTable() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState("");
    const { onlineUserIds } = usePresence();
    const supabase = createClient();

    // Fetch user data
    useEffect(() => {
        async function fetchUsers() {
            try {
                setLoading(true);
                const { data, error } = await supabase.rpc("get_all_users");

                if (error) throw error;
                setUsers(data || []);
            } catch (err: any) {
                console.error("Error fetching users:", err);
                setError(err.message || "Failed to load user data");
            } finally {
                setLoading(false);
            }
        }

        fetchUsers();
    }, []);

    const filteredUsers = users.filter((user) =>
        user.email?.toLowerCase().includes(filter.toLowerCase())
    );

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
                    Note: The 'get_all_users' RPC function in Supabase may be missing or inaccessible.
                </p>
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
                                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400">Account Created</TableHead>
                                    <TableHead className="font-semibold text-slate-600 dark:text-slate-400 text-right pr-6">Last Active</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-32 text-center text-slate-500 font-medium">
                                            No user accounts match your search criteria.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((user) => {
                                        const online = isOnline(user);
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
                                                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{user.email}</span>
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
                                                    {new Date(user.created_at).toLocaleDateString(undefined, {
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </TableCell>
                                                <TableCell className="text-slate-500 dark:text-slate-400 font-medium text-sm text-right pr-6">
                                                    {online ? (
                                                        <span className="text-green-600 dark:text-green-400 font-semibold">
                                                            Right now
                                                        </span>
                                                    ) : user.last_sign_in_at ? (
                                                        <span>
                                                            {formatDistanceToNow(parseISO(user.last_sign_in_at), { addSuffix: true })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 italic">Never</span>
                                                    )}
                                                </TableCell>
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
        </div>
    );
}

// Add a simple label component mock or import to prevent compilation error if not already imported
function Label({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <label className={className}>
            {children}
        </label>
    );
}
