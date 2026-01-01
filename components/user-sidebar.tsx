"use client";

import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import Image from "next/image";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, Bell, Sparkles, User as UserIcon } from "lucide-react";
import { signOutAction } from "@/app/actions";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface UserMenuProps {
    isCollapsed: boolean;
}

export function UserSidebar({ isCollapsed }: UserMenuProps) {
    const [user, setUser] = useState<User | null>(null);
    const supabase = createClient();

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();
    }, []);

    if (!user) return null;

    return (
        <div className="px-4 py-4">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        className={cn(
                            "flex items-center w-full gap-3 p-2 rounded-[1.25rem] transition-all duration-500 group relative overflow-hidden",
                            "hover:bg-slate-100 dark:hover:bg-slate-800/50 animate-in fade-in slide-in-from-bottom-2",
                            isCollapsed ? "justify-center" : "px-3"
                        )}
                    >
                        <div className="relative shrink-0">
                            <div className="h-10 w-10 rounded-xl overflow-hidden border-2 border-slate-100 dark:border-slate-800/50 shadow-sm transition-transform group-hover:scale-105 group-hover:rotate-3 duration-500">
                                <Image
                                    src="/placeholder-user.jpg"
                                    width={40}
                                    height={40}
                                    alt="Avatar"
                                    className="object-cover"
                                />
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 bg-blue-500 shadow-sm animate-pulse" />
                        </div>

                        {!isCollapsed && (
                            <div className="flex flex-col items-start min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 w-full">
                                    <span className="text-sm font-black text-slate-900 dark:text-white truncate tracking-tight">
                                        {user.email?.split('@')[0].toUpperCase()}
                                    </span>
                                    <div className="h-4 w-4 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                        <Sparkles className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                </div>
                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate w-full flex items-center gap-1">
                                    <div className="h-1 w-1 rounded-full bg-blue-500" />
                                    Administrator
                                </span>
                            </div>
                        )}
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isCollapsed ? "center" : "start"} side={isCollapsed ? "right" : "top"} className="w-56 rounded-[1.5rem] p-2 shadow-2xl border-slate-100 dark:border-slate-800">
                    <DropdownMenuLabel className="px-3 py-2 flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Account Access</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.email}</span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800 mx-1" />
                    <div className="p-1 space-y-1">
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/user" className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <Settings className="h-4 w-4 text-slate-400" />
                                <span className="font-bold text-xs text-slate-600 dark:text-slate-300">Settings</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/dashboard/system-updates" className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <Sparkles className="h-4 w-4 text-slate-400" />
                                <span className="font-bold text-xs text-slate-600 dark:text-slate-300">New Updates</span>
                            </Link>
                        </DropdownMenuItem>
                    </div>
                    <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800 mx-1" />
                    <div className="p-1">
                        <form action={signOutAction}>
                            <button
                                type="submit"
                                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400 transition-colors"
                            >
                                <LogOut className="h-4 w-4" />
                                <span className="font-bold text-xs">Sign Out</span>
                            </button>
                        </form>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
