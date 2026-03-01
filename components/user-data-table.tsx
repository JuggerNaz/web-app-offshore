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
import { Loader2, Search, User as UserIcon, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";

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
    const supabase = createClient();

    useEffect(() => {
        async function fetchUsers() {
            try {
                setLoading(true);
                // Call the RPC function we created
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

    const isOnline = (lastSignIn: string | null) => {
        if (!lastSignIn) return false;
        const date = parseISO(lastSignIn);
        const now = new Date();
        // Consider online if signed in within the last 5 minutes
        // Note: This is a rough proxy since we don't have real-time presence
        const diffInMinutes = (now.getTime() - date.getTime()) / 1000 / 60;
        return diffInMinutes < 60; // Show "Online" for roughly last hour just to be generous for this demo
    };

    const getInitials = (email: string) => {
        if (!email) return "U";
        return email.substring(0, 2).toUpperCase();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 border border-red-200 bg-red-50 text-red-700 rounded-lg dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                <h3 className="font-bold mb-2">Error Loading Data</h3>
                <p>{error}</p>
                <p className="text-sm mt-2 opacity-80">
                    Did you run the SQL script to create the <code>get_all_users</code> function?
                </p>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Registered Users</CardTitle>
                <CardDescription>
                    A list of all users registered in the system.
                </CardDescription>
                <div className="mt-4">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="search"
                            placeholder="Search by email..."
                            className="pl-8 max-w-sm"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Joined</TableHead>
                                <TableHead>Last Sign In</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        No users found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map((user) => {
                                    const online = isOnline(user.last_sign_in_at);
                                    return (
                                        <TableRow key={user.id}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-9 w-9">
                                                        <AvatarImage src="" />
                                                        <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium">{user.email}</span>
                                                        <span className="text-xs text-muted-foreground font-mono">
                                                            {user.id.substring(0, 8)}...
                                                        </span>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={online ? "default" : "secondary"}
                                                    className="gap-1.5"
                                                >
                                                    <span
                                                        className={`h-2 w-2 rounded-full ${online ? "bg-green-400 animate-pulse" : "bg-slate-400"
                                                            }`}
                                                    />
                                                    {online ? "Online" : "Offline"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {user.last_sign_in_at
                                                    ? formatDistanceToNow(parseISO(user.last_sign_in_at), { addSuffix: true })
                                                    : "Never"}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="text-xs text-muted-foreground mt-4">
                    Total Users: {filteredUsers.length}
                </div>
            </CardContent>
        </Card>
    );
}
