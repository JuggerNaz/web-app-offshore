"use client";

import { useState, useEffect } from "react";
import { 
    Waves, 
    Plus, 
    Search, 
    ChevronRight, 
    Trash2, 
    CheckCircle2, 
    Clock, 
    Info, 
    Save, 
    X, 
    ArrowLeft,
    Layers,
    AlertTriangle,
    ArrowUpDown,
    MoreVertical,
    FileText,
    Settings2,
    Check
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter 
} from "@/components/ui/dialog";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

interface MGIProfile {
    id: number;
    name: string;
    description: string;
    thresholds: Array<{ from_elevation: string | number; max_thickness: number }>;
    is_active: boolean;
    is_job_specific: boolean;
    created_at: string;
    created_by: string;
    updated_at: string;
    updated_by: string;
}

interface JobPack {
    id: number;
    name: string;
    metadata: any;
    mgi_profile_id?: number;
}

const ELEVATION_LABELS = [
    { label: "MSL (0m)", value: "MSL" },
    { label: "1/4 WD", value: "1/4 WD" },
    { label: "1/3 WD", value: "1/3 WD" },
    { label: "1/2 WD", value: "1/2 WD" },
    { label: "2/3 WD", value: "2/3 WD" },
    { label: "3/4 WD", value: "3/4 WD" },
    { label: "Mudline", value: "Mudline" }
];

export default function MGIProfilerPage() {
    const supabase = createClient();
    const router = useRouter();
    
    // State
    const [profiles, setProfiles] = useState<MGIProfile[]>([]);
    const [jobPacks, setJobPacks] = useState<JobPack[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"PROFILES" | "JOBWISE">("PROFILES");
    
    // Form State
    const [editingProfile, setEditingProfile] = useState<Partial<MGIProfile> | null>(null);
    const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        try {
            const [profilesRes, jobpacksRes] = await Promise.all([
                fetch('/api/mgi-profiles').then(res => res.json()),
                supabase.from('jobpack').select('id, name, metadata, mgi_profile_id').order('created_at', { ascending: false })
            ]);

            if (profilesRes.data) setProfiles(profilesRes.data);
            if (jobpacksRes.data) setJobPacks(jobpacksRes.data);
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    }

    const handleCreateProfile = () => {
        setEditingProfile({
            name: "",
            description: "",
            thresholds: [{ from_elevation: "MSL", max_thickness: 127 }],
            is_active: true,
            is_job_specific: false
        });
        setIsFormOpen(true);
    };

    const handleEditProfile = (profile: MGIProfile) => {
        setEditingProfile({...profile});
        setIsFormOpen(true);
    };

    const handleAddThreshold = () => {
        if (!editingProfile) return;
        const thresholds = [...(editingProfile.thresholds || [])];
        thresholds.push({ from_elevation: "Mudline", max_thickness: 25 });
        setEditingProfile({ ...editingProfile, thresholds });
    };

    const handleRemoveThreshold = (index: number) => {
        if (!editingProfile) return;
        const thresholds = [...(editingProfile.thresholds || [])].filter((_, i) => i !== index);
        setEditingProfile({ ...editingProfile, thresholds });
    };

    const handleSaveProfile = async () => {
        if (!editingProfile?.name) return toast.error("Profile name is required");
        
        try {
            const method = editingProfile.id ? 'PATCH' : 'POST';
            const url = editingProfile.id ? `/api/mgi-profiles/${editingProfile.id}` : '/api/mgi-profiles';
            
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingProfile)
            });
            
            if (!res.ok) throw new Error("Failed to save profile");
            
            toast.success(editingProfile.id ? "Profile updated" : "Profile created");
            setIsFormOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Error saving profile");
        }
    };

    async function handleLinkProfile() {
        if (!selectedJobId || !editingProfile?.id) return;
        
        try {
            const { error } = await supabase
                .from('jobpack')
                .update({ mgi_profile_id: editingProfile.id })
                .eq('id', selectedJobId);
            
            if (error) throw error;
            
            toast.success("Jobpack linked successfully");
            setIsLinkDialogOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Error linking jobpack");
        }
    };

    const filteredProfiles = profiles.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredJobPacks = jobPacks.filter(j => 
        j.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex-1 w-full p-6 overflow-y-auto bg-slate-50/50 dark:bg-slate-950">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Back Button */}
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => router.back()} 
                    className="group h-8 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-500 font-bold transition-all px-0 hover:px-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                    Back to previous
                </Button>
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-rose-600/10 rounded-2xl">
                            <Waves className="w-8 h-8 text-rose-600" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">MGI Profiler</h1>
                            <p className="text-slate-500 font-medium">Manage Marine Growth thickness thresholds and elevation rules</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <div className="flex bg-slate-200/60 dark:bg-slate-900 p-1 rounded-xl">
                            <Button 
                                variant={viewMode === "PROFILES" ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setViewMode("PROFILES")}
                                className="rounded-lg font-bold"
                            >
                                <Settings2 className="w-4 h-4 mr-2" />
                                Profiles
                            </Button>
                            <Button 
                                variant={viewMode === "JOBWISE" ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setViewMode("JOBWISE")}
                                className="rounded-lg font-bold"
                            >
                                <FileText className="w-4 h-4 mr-2" />
                                Jobwise
                            </Button>
                        </div>
                        <Button onClick={handleCreateProfile} className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-lg shadow-rose-600/20 px-6">
                            <Plus className="w-5 h-5 mr-2" />
                            New Profile
                        </Button>
                    </div>
                </div>

                {/* Main Content */}
                <Card className="border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden rounded-2xl bg-white dark:bg-slate-950">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input 
                                placeholder={viewMode === "PROFILES" ? "Search profiles..." : "Search jobpacks..."} 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-11 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium text-sm rounded-xl focus-visible:ring-rose-500"
                            />
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest bg-white dark:bg-slate-800 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700">
                            <Clock className="w-3.5 h-3.5" />
                            Active Profile: <span className="text-rose-600 ml-1">{profiles.find(p => p.is_active && !p.is_job_specific)?.name || "Not Found"}</span>
                        </div>
                    </div>

                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800">
                                    {viewMode === "PROFILES" ? (
                                        <>
                                            <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 pl-6">Profile Name</TableHead>
                                            <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 text-center">Thresholds</TableHead>
                                            <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 text-center">Type</TableHead>
                                            <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 text-center">Status</TableHead>
                                            <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 pr-6 text-right">Actions</TableHead>
                                        </>
                                    ) : (
                                        <>
                                            <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 pl-6">Jobpack</TableHead>
                                            <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500">MGI Profile</TableHead>
                                            <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 text-center">Status</TableHead>
                                            <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 pr-6 text-right">Actions</TableHead>
                                        </>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-64 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <Waves className="w-10 h-10 text-rose-600 animate-pulse" />
                                                <span className="text-slate-500 font-bold">Synchronizing Profiles...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : viewMode === "PROFILES" ? (
                                    filteredProfiles.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-48 text-center text-slate-400 font-medium">
                                                No profiles found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredProfiles.map((profile) => (
                                            <TableRow key={profile.id} className="hover:bg-rose-50/30 dark:hover:bg-rose-950/10 transition-colors border-slate-100 dark:border-slate-800">
                                                <TableCell className="pl-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-900 dark:text-white text-base">{profile.name}</span>
                                                        <span className="text-slate-400 text-xs truncate max-w-xs">{profile.description || "No description"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 font-bold text-rose-600 text-[10px] px-2.5">
                                                        {profile.thresholds.length} Segments
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className={`rounded-lg py-0 px-2 text-[10px] font-black ${profile.is_job_specific ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 border-amber-200" : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 border-blue-200"}`}>
                                                        {profile.is_job_specific ? "JOB-SPECIFIC" : "GLOBAL"}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {profile.is_active ? (
                                                        <div className="flex items-center justify-center gap-1.5 text-emerald-600 font-bold text-[10px] uppercase tracking-widest">
                                                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                            Active
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Inactive</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="pr-6 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-rose-100 hover:text-rose-600" onClick={() => handleEditProfile(profile)}>
                                                            <Settings2 className="w-4.5 h-4.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-slate-100 text-slate-400 hover:text-rose-600">
                                                            <Trash2 className="w-4.5 h-4.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )
                                ) : (
                                    filteredJobPacks.map((job) => {
                                        const profile = profiles.find(p => p.id === job.mgi_profile_id);
                                        return (
                                            <TableRow key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors border-slate-100 dark:border-slate-800">
                                                <TableCell className="pl-6 py-4 font-bold text-slate-800 dark:text-white">
                                                    {job.name}
                                                </TableCell>
                                                <TableCell>
                                                    {profile ? (
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="secondary" className="bg-rose-100 text-rose-600 border-rose-200">
                                                                {profile.name}
                                                            </Badge>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs italic">Default Profile Active</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px] font-black">{job.metadata?.status || 'Active'}</Badge>
                                                </TableCell>
                                                <TableCell className="pr-6 text-right">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-8 font-bold border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg"
                                                        onClick={() => {
                                                            setSelectedJobId(job.id);
                                                            setIsLinkDialogOpen(true);
                                                        }}
                                                    >
                                                        Switch Profile
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Profile Form Dialog */}
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogContent className="max-w-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-2xl p-0 overflow-hidden">
                        <DialogHeader className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                            <DialogTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                                {editingProfile?.id ? "Edit MGI Profile" : "Create MGI Profile"}
                            </DialogTitle>
                            <DialogDescription className="font-medium">Define marine growth limits based on elevation ranges.</DialogDescription>
                        </DialogHeader>
                        
                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Profile Name</Label>
                                    <Input 
                                        value={editingProfile?.name || ""} 
                                        onChange={(e) => setEditingProfile({...editingProfile!, name: e.target.value})}
                                        placeholder="e.g. South China Sea Standard"
                                        className="h-11 font-bold border-slate-200 dark:border-slate-800 focus-visible:ring-rose-500"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Profile Type</Label>
                                    <div className="flex items-center h-11 gap-4 px-3 border border-slate-200 dark:border-slate-800 rounded-md bg-slate-50/50 dark:bg-slate-900/50">
                                        <div className="flex items-center gap-2 flex-1">
                                            <Switch 
                                                checked={editingProfile?.is_job_specific} 
                                                onCheckedChange={(checked) => setEditingProfile({...editingProfile!, is_job_specific: checked})}
                                                className="data-[state=checked]:bg-rose-500"
                                            />
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Job Specific</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">Description</Label>
                                <Input 
                                    value={editingProfile?.description || ""} 
                                    onChange={(e) => setEditingProfile({...editingProfile!, description: e.target.value})}
                                    placeholder="Enter details about this profile's application area..."
                                    className="h-11 font-medium border-slate-200 dark:border-slate-800 focus-visible:ring-rose-500"
                                />
                            </div>

                            <Separator className="bg-slate-100 dark:bg-slate-800" />

                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Layers className="w-5 h-5 text-rose-500" />
                                        <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-sm">Elevation Segments</h3>
                                    </div>
                                    <Button size="sm" variant="outline" className="h-8 rounded-lg font-bold text-rose-600 border-rose-200 hover:bg-rose-50" onClick={handleAddThreshold}>
                                        <Plus className="w-4 h-4 mr-1" /> Add Segment
                                    </Button>
                                </div>

                                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                                <TableHead className="font-bold text-[10px] uppercase text-slate-500 w-[240px]">From Elevation (Resolvable)</TableHead>
                                                <TableHead className="font-bold text-[10px] uppercase text-slate-500">Max Thickness (mm)</TableHead>
                                                <TableHead className="w-12"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {editingProfile?.thresholds?.map((t, idx) => (
                                                <TableRow key={idx} className="border-b border-slate-100 dark:border-slate-900 last:border-0 grow-row transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                                    <TableCell className="p-3">
                                                        {ELEVATION_LABELS.some(el => el.value === String(t.from_elevation)) ? (
                                                            <Select 
                                                                value={String(t.from_elevation)} 
                                                                onValueChange={(val) => {
                                                                    const newT = [...editingProfile!.thresholds!];
                                                                    if (val === "MANUAL") {
                                                                        newT[idx].from_elevation = "0"; // Initialize with 0 for manual
                                                                    } else {
                                                                        newT[idx].from_elevation = val;
                                                                    }
                                                                    setEditingProfile({...editingProfile!, thresholds: newT});
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-9 font-bold bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                                                                    <SelectValue placeholder="Select Label" />
                                                                </SelectTrigger>
                                                                <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                                                                    {ELEVATION_LABELS.map(el => (
                                                                        <SelectItem key={el.value} value={el.value} className="font-bold">{el.label}</SelectItem>
                                                                    ))}
                                                                    <SelectItem value="MANUAL" className="italic font-bold text-rose-600">Custom Value...</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <div className="relative flex-1">
                                                                    <Input 
                                                                        type="text"
                                                                        value={t.from_elevation}
                                                                        onChange={(e) => {
                                                                            const newT = [...editingProfile!.thresholds!];
                                                                            newT[idx].from_elevation = e.target.value;
                                                                            setEditingProfile({...editingProfile!, thresholds: newT});
                                                                        }}
                                                                        className="h-9 font-bold pr-8 border-rose-200 dark:border-rose-900 focus-visible:ring-rose-500"
                                                                        placeholder="Depth (m)"
                                                                    />
                                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-rose-400">m</span>
                                                                </div>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                                                    onClick={() => {
                                                                        const newT = [...editingProfile!.thresholds!];
                                                                        newT[idx].from_elevation = "MSL";
                                                                        setEditingProfile({...editingProfile!, thresholds: newT});
                                                                    }}
                                                                    title="Switch back to preset labels"
                                                                >
                                                                    <ArrowUpDown className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="p-3">
                                                        <Input 
                                                            type="number"
                                                            value={t.max_thickness}
                                                            onChange={(e) => {
                                                                const newT = [...editingProfile!.thresholds!];
                                                                newT[idx].max_thickness = parseInt(e.target.value) || 0;
                                                                setEditingProfile({...editingProfile!, thresholds: newT});
                                                            }}
                                                            className="h-9 font-bold text-center border-slate-200 dark:border-slate-800 focus-visible:ring-rose-500"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="p-2">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 text-slate-400 hover:text-rose-600"
                                                            onClick={() => handleRemoveThreshold(idx)}
                                                            disabled={editingProfile.thresholds!.length <= 1}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="flex items-start gap-2 p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                                    <Info className="w-4 h-4 text-blue-500 mt-0.5" />
                                    <p className="text-[10px] font-medium text-blue-700 dark:text-blue-400">
                                        Segments are applied from the specified elevation downwards. MSL resolves to 0m, Mudline to -Water Depth.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                           <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <Switch 
                                        checked={editingProfile?.is_active} 
                                        onCheckedChange={(checked) => setEditingProfile({...editingProfile!, is_active: checked})}
                                        className="data-[state=checked]:bg-emerald-500"
                                    />
                                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Set as Active Profile</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button variant="ghost" className="font-bold text-slate-500" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                                    <Button className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-8 rounded-xl shadow-lg shadow-rose-600/20" onClick={handleSaveProfile}>
                                        <Save className="w-4 h-4 mr-2" />
                                        Save Profile
                                    </Button>
                                </div>
                           </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Linking Dialog */}
                <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
                    <DialogContent className="max-w-md bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black tracking-tight">Set Job-Specific Profile</DialogTitle>
                            <DialogDescription className="font-medium">Override the global default for this specific jobpack.</DialogDescription>
                        </DialogHeader>
                        
                        <div className="py-6 space-y-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-500">MGI profile</Label>
                                <Select value={editingProfile?.id?.toString() || ""} onValueChange={(val) => setEditingProfile(profiles.find(p => p.id === Number(val)) || null)}>
                                    <SelectTrigger className="font-bold h-12">
                                        <SelectValue placeholder="Select Profile" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                                        {profiles.map(p => (
                                            <SelectItem key={p.id} value={p.id.toString()} className="font-bold">
                                                {p.name} {p.is_active && !p.is_job_specific ? "(Global Default)" : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="p-4 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/30 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-rose-500" />
                                <p className="text-xs font-medium text-rose-700 dark:text-rose-400">
                                    Linking a profile will immediately apply its thresholds to all MGI/RMGI inspections for this jobpack across all stations.
                                </p>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="ghost" className="font-bold text-slate-500" onClick={() => setIsLinkDialogOpen(false)}>Cancel</Button>
                            <Button 
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-8 rounded-xl"
                                onClick={handleLinkProfile}
                            >
                                Apply to Jobpack
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}
