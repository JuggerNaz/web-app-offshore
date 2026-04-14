"use client";

import { UserData } from "@/types/user";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format, parseISO } from "date-fns";
import { 
    Mail, 
    Briefcase, 
    Shield, 
    Calendar, 
    Hash, 
    Activity, 
    Globe, 
    Clock,
    User as UserIcon,
    CheckCircle2,
    Lock,
    Sparkles
} from "lucide-react";
import { motion } from "framer-motion";

interface UserProfileCardProps {
    user: UserData;
    isOnline: boolean;
    isMe?: boolean;
    currentUserMetadata?: {
        full_name?: string;
        designation?: string;
        avatar_url?: string;
    } | null;
}

export function UserProfileCard({ user, isOnline, isMe, currentUserMetadata }: UserProfileCardProps) {
    const getInitials = (name: string, email: string) => {
        if (name) {
            const parts = name.split(' ');
            if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
            return name.substring(0, 2).toUpperCase();
        }
        return email.substring(0, 2).toUpperCase();
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "Never";
        try {
            return format(new Date(dateStr), "dd MMM yyyy, HH:mm:ss");
        } catch (e) {
            return dateStr;
        }
    };

    // Resolve name, designation and avatar prioritizing current user session metadata if applicable
    const resolvedName = (isMe && currentUserMetadata?.full_name) 
        ? currentUserMetadata.full_name 
        : (user.full_name || user.email.split('@')[0]);

    const resolvedDesignation = (isMe && currentUserMetadata?.designation)
        ? currentUserMetadata.designation
        : (user.designation || "Offshore Staff");

    const resolvedAvatar = (isMe && currentUserMetadata?.avatar_url)
        ? currentUserMetadata.avatar_url
        : (user.avatar_url || "");

    return (
        <Card className="border-0 shadow-none bg-transparent overflow-hidden">
            {/* Header / Avatar Area */}
            <div className="relative h-40 bg-gradient-to-br from-indigo-600 via-blue-600 to-emerald-500 dark:from-indigo-900 dark:via-blue-900 dark:to-emerald-900">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                <div className="absolute -bottom-16 left-8">
                    <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        className="relative"
                    >
                        <div className="rounded-full p-1.5 bg-white/30 backdrop-blur-md shadow-2xl border border-white/50">
                            <Avatar className="h-32 w-32 border-4 border-white dark:border-slate-950 shadow-2xl ring-4 ring-indigo-500/20">
                                <AvatarImage src={resolvedAvatar} className="object-cover" />
                                <AvatarFallback className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-3xl font-black">
                                    {getInitials(resolvedName, user.email)}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <div className={`absolute bottom-3 right-3 h-7 w-7 rounded-full border-4 border-white dark:border-slate-950 shadow-lg ${isOnline ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.8)]' : 'bg-slate-400'}`} />
                    </motion.div>
                </div>
                <div className="absolute top-6 right-6 flex flex-col items-end gap-2 text-white">
                    <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'} className={`${user.role === 'Admin' ? "bg-amber-500 text-white" : "bg-white/20 backdrop-blur-md text-white border-0"} px-4 py-1.5 font-black uppercase text-[10px] tracking-widest shadow-lg`}>
                        {user.role || 'User'}
                    </Badge>
                    {isMe && <Badge className="bg-blue-500/80 backdrop-blur-md text-white border-0 px-3 py-1 font-black text-[9px] uppercase shadow-lg">Current User</Badge>}
                </div>
            </div>

            <CardContent className="pt-20 pb-8 px-8 space-y-8 bg-white dark:bg-slate-950">
                {/* Essential Info */}
                <div className="space-y-2">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center gap-3"
                    >
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                            {resolvedName}
                        </h2>
                        <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
                    </motion.div>
                    <motion.p 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-lg text-slate-500 font-bold flex items-center gap-2.5"
                    >
                        <Briefcase className="h-5 w-5 text-indigo-500" />
                        {resolvedDesignation}
                    </motion.p>
                </div>

                <Separator className="opacity-50" />

                {/* Info Grid - Visualized as Stylish Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <InfoCard 
                        icon={<Mail className="h-5 w-5 text-blue-500" />} 
                        label="Email Address" 
                        value={user.email} 
                        delay={0.3}
                    />
                    <InfoCard 
                        icon={<Hash className="h-5 w-5 text-slate-500" />} 
                        label="Personnel ID" 
                        value={user.id.substring(0, 8).toUpperCase()} 
                        delay={0.35}
                    />
                    <InfoCard 
                        icon={<Calendar className="h-5 w-5 text-emerald-500" />} 
                        label="Registered Date" 
                        value={formatDate(user.created_at)} 
                        delay={0.4}
                    />
                    <InfoCard 
                        icon={<Activity className="h-5 w-5 text-amber-500" />} 
                        label="Last Activity" 
                        value={isOnline ? "Right now" : formatDate(user.last_seen_at || user.last_sign_in_at)} 
                        delay={0.45}
                    />
                </div>

                {/* Modules Section */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="space-y-4 pt-2 bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800"
                >
                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
                        <Lock className="h-3.5 w-3.5" />
                        Platform Module Access
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                        {user.modules && user.modules.length > 0 ? (
                            user.modules.map((mod) => (
                                <Badge 
                                    key={mod} 
                                    className="bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 font-black px-4 py-1.5 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    {mod}
                                </Badge>
                            ))
                        ) : (
                            <div className="text-sm text-slate-400 font-medium italic py-2">
                                No security modules assigned to this personnel ID
                            </div>
                        )}
                    </div>
                </motion.div>
                
                {/* Connection Status Footnote */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className={`p-4 rounded-xl border flex items-center gap-4 ${
                        isOnline 
                        ? "bg-green-50 border-green-100 text-green-700 dark:bg-green-950/20 dark:border-green-900/50 dark:text-green-400" 
                        : "bg-slate-50 border-slate-100 text-slate-600 dark:bg-slate-900/50 dark:border-slate-800 dark:text-slate-400"
                    }`}
                >
                    <div className="relative flex h-3 w-3">
                        {isOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${isOnline ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest leading-none">
                            {isOnline ? "Connected to platform" : "Currently Offline / Disconnected"}
                        </p>
                        <p className="text-[10px] opacity-70 mt-1 font-bold">
                            {isOnline ? "Real-time presence confirmed via encrypted socket heartbeat" : "Last recorded heartbeat was successful"}
                        </p>
                    </div>
                    {isOnline && <CheckCircle2 className="h-5 w-5 ml-auto opacity-50" />}
                </motion.div>
            </CardContent>
        </Card>
    );
}

function InfoCard({ icon, label, value, delay }: { icon: React.ReactNode, label: string, value: string, delay: number }) {
    return (
        <motion.div 
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay, type: "spring", stiffness: 100 }}
            className="flex flex-col gap-2 p-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900 group"
        >
            <div className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-400 transition-colors">
                {icon}
                {label}
            </div>
            <div className="text-[15px] font-bold text-slate-800 dark:text-slate-100 truncate" title={value}>
                {value}
            </div>
        </motion.div>
    );
}
