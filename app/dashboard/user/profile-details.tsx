"use client";

import { useState, useRef } from "react";
import { 
    User as UserIcon, 
    Mail, 
    Key, 
    Calendar, 
    Globe, 
    Edit3, 
    Save, 
    X, 
    Camera,
    Loader2,
    Briefcase
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { updateUserProfileAction } from "@/app/actions";

interface ProfileDetailsProps {
    user: any;
}

export function ProfileDetails({ user }: ProfileDetailsProps) {
    const supabase = createClient();
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Form State
    const [fullName, setFullName] = useState(user.user_metadata?.full_name || "");
    const [designation, setDesignation] = useState(user.user_metadata?.designation || "");
    const [avatarUrl, setAvatarUrl] = useState(user.user_metadata?.avatar_url || "");

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);

            if (!event.target.files || event.target.files.length === 0) {
                throw new Error("You must select an image to upload.");
            }

            const file = event.target.files[0];
            const fileExt = file.name.split(".").pop();
            const fileName = `${user.id}-${Math.random()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            // Upload the file to "attachments" bucket (or "avatars" if it exists)
            // Based on previous research, "attachments" bucket's POST route exists.
            const { error: uploadError } = await supabase.storage
                .from("attachments")
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from("attachments")
                .getPublicUrl(filePath);

            setAvatarUrl(publicUrl);
            
            // Auto-save the new avatar URL to metadata
            const formData = new FormData();
            formData.append("full_name", fullName);
            formData.append("designation", designation);
            formData.append("avatar_url", publicUrl);
            
            await updateUserProfileAction(formData);
            
            toast.success("Profile photo updated successfully!");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append("full_name", fullName);
            formData.append("designation", designation);
            formData.append("avatar_url", avatarUrl);

            const result = await updateUserProfileAction(formData);

            if (result?.error) {
                throw new Error(result.error);
            }

            toast.success("Profile updated successfully!");
            setIsEditing(false);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getInitials = (name: string, email: string) => {
        if (name) {
            const parts = name.split(" ");
            if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
            return name.substring(0, 2).toUpperCase();
        }
        return email.substring(0, 2).toUpperCase();
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sidebar with Avatar */}
            <div className="lg:col-span-1">
                <Card className="border-none shadow-md overflow-hidden bg-white/50 backdrop-blur-sm">
                    <CardHeader className="text-center pb-2">
                        <div className="flex justify-center mb-6 relative group">
                            <div className="relative">
                                <Avatar className="h-32 w-32 border-4 border-white shadow-xl">
                                    <AvatarImage src={avatarUrl} alt="Profile" className="object-cover" />
                                    <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600">
                                        {getInitials(fullName, user.email || "U")}
                                    </AvatarFallback>
                                </Avatar>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="absolute bottom-0 right-0 p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all hover:scale-110 disabled:opacity-50 disabled:scale-100"
                                >
                                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                                </button>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handleUpload}
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-black text-slate-800 tracking-tight">
                                {fullName || user.email?.split('@')[0]}
                            </CardTitle>
                            <p className="text-sm font-bold text-blue-600 uppercase tracking-widest flex items-center justify-center gap-1.5 mt-1">
                                <Briefcase className="w-3.5 h-3.5" />
                                {designation || "Offshore Professional"}
                            </p>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Separator className="mb-6 opacity-50" />
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <Mail className="w-4 h-4 text-slate-400" />
                                <span className="font-medium truncate">{user.email}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <Globe className="w-4 h-4 text-slate-400" />
                                <span className="font-medium">Active Member</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Profile Info */}
            <div className="lg:col-span-2">
                <Card className="border-none shadow-md bg-white">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7 border-b">
                        <div className="space-y-1">
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <UserIcon className="w-5 h-5 text-blue-600" />
                                Profile Information
                            </CardTitle>
                            <CardDescription>Update your personal details and professional designation</CardDescription>
                        </div>
                        <Button 
                            variant={isEditing ? "ghost" : "outline"}
                            size="sm"
                            className={`font-bold transition-all ${isEditing ? 'text-slate-400' : 'text-blue-600 border-blue-100 hover:bg-blue-50'}`}
                            onClick={() => setIsEditing(!isEditing)}
                        >
                            {isEditing ? (
                                <><X className="w-4 h-4 mr-2" /> CANCEL</>
                            ) : (
                                <><Edit3 className="w-4 h-4 mr-2" /> EDIT PROFILE</>
                            )}
                        </Button>
                    </CardHeader>
                    <CardContent className="pt-8">
                        {isEditing ? (
                            <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                    <div className="space-y-2.5">
                                        <Label htmlFor="full_name" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Full Name</Label>
                                        <div className="relative">
                                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <Input 
                                                id="full_name"
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                                className="pl-10 h-12 text-sm font-bold border-slate-200 focus:border-blue-400 focus:ring-blue-100 transition-all"
                                                placeholder="Enter your full name"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2.5">
                                        <Label htmlFor="designation" className="text-xs font-black uppercase tracking-widest text-slate-400 ml-1">Designation</Label>
                                        <div className="relative">
                                            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <Input 
                                                id="designation"
                                                value={designation}
                                                onChange={(e) => setDesignation(e.target.value)}
                                                className="pl-10 h-12 text-sm font-bold border-slate-200 focus:border-blue-400 focus:ring-blue-100 transition-all"
                                                placeholder="e.g. Senior ROV Engineer"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <Button 
                                        onClick={handleSave} 
                                        disabled={isLoading}
                                        className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-200 transition-all hover:scale-105 active:scale-95"
                                    >
                                        {isLoading ? (
                                            <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> SAVING...</>
                                        ) : (
                                            <><Save className="w-5 h-5 mr-3" /> SAVE CHANGES</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                    <div className="space-y-1.5 flex flex-col border-b border-slate-50 pb-4">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Full Name</span>
                                        <span className="text-base font-black text-slate-800">{fullName || "Not specified"}</span>
                                    </div>
                                    <div className="space-y-1.5 flex flex-col border-b border-slate-50 pb-4">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Designation</span>
                                        <span className="text-base font-black text-slate-800">{designation || "Not specified"}</span>
                                    </div>
                                    <div className="space-y-1.5 flex flex-col border-b border-slate-50 pb-4">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Email Address</span>
                                        <span className="text-sm font-bold text-slate-500">{user.email}</span>
                                    </div>
                                    <div className="space-y-1.5 flex flex-col border-b border-slate-50 pb-4">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Account Created</span>
                                        <span className="text-sm font-bold text-slate-500">{formatDate(user.created_at)}</span>
                                    </div>
                                </div>

                                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100/50 flex items-start gap-4">
                                    <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                                        <Key className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-blue-800 uppercase tracking-widest mb-0.5">System Identifier</p>
                                        <p className="text-[10px] font-mono font-bold text-blue-500/70">{user.id}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
