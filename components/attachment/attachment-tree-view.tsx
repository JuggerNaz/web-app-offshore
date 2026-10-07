"use client";

import { useAttachmentStore } from "@/stores/attachment-store";
import { useState, useMemo, Fragment } from "react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    ChevronRight,
    ChevronDown,
    FileText,
    Box,
    Loader2,
    Paperclip,
    Search,
    Filter,
    ClipboardList,
    AlertTriangle,
    CheckCircle2,
    FileClock,
    ExternalLink,
    Calendar,
    Edit2,
    Plus,
    Film,
    Image as ImageIcon,
    Folder,
    Layers,
    MapPin,
    Eye,
    EyeOff,
    Maximize2,
    X,
    Download,
    Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DataTable } from "../data-table/data-table";
import { attachments as attachmentColumns, globalAttachments, Platform, Attachment } from "../data-table/columns";
import { processAttachmentUrl, truncateText } from "@/utils/storage";
import { getAttachmentCategory, AttachmentCategory, ATTACHMENT_CATEGORY_LABELS } from "@/utils/attachment-category";
import { useAttachmentRealtime } from "@/hooks/use-attachment-realtime";
import { refreshAttachmentCaches } from "@/utils/attachment-sync";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { getAttachmentUrl } from "@/utils/attachment-utils";
import { AttachmentEditorDialog } from "@/app/dashboard/inspection-v2/workspace/components/AttachmentEditorDialog";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

export default function AttachmentTreeView() {
    // Enable live cross-user updates for tree view & counts
    useAttachmentRealtime(refreshAttachmentCaches);

    const { filters, selectedPlatformId, setSelectedPlatformId, openSlideOver } = useAttachmentStore();
    const { searchQuery, hasAttachmentsOnly } = filters;

    const [categoryFilter, setCategoryFilter] = useState<AttachmentCategory | "ALL">("ALL");

    // Fetch all platforms
    const { data: platformsData, isLoading: isLoadingPlatforms } = useSWR('/api/platform?pageSize=1000', fetcher);

    // Fetch real attachment counts aggregated per platform
    const { data: countsData } = useSWR('/api/attachment/counts', fetcher);
    const platformCounts: Record<number, number> = useMemo(() => countsData?.counts || {}, [countsData]);

    const allPlatforms = useMemo(() => (platformsData?.data || []) as Platform[], [platformsData]);

    // Filter Platforms
    const filteredPlatforms = useMemo(() => {
        return allPlatforms.filter(platform => {
            const matchesSearch = platform.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (platform.pfield && platform.pfield.toLowerCase().includes(searchQuery.toLowerCase()));

            if (!matchesSearch) return false;

            if (hasAttachmentsOnly) {
                const count = platformCounts[platform.plat_id] || 0;
                return count > 0;
            }

            return true;
        });
    }, [allPlatforms, platformCounts, searchQuery, hasAttachmentsOnly]);

    // Group platforms by field
    const groupedPlatforms = useMemo(() => {
        return filteredPlatforms.reduce((acc, platform) => {
            const fieldName = platform.pfield || "Unassigned Field";
            if (!acc[fieldName]) {
                acc[fieldName] = [];
            }
            acc[fieldName].push(platform);
            return acc;
        }, {} as Record<string, Platform[]>);
    }, [filteredPlatforms]);

    // Set selected platform
    const activePlatform = useMemo(() => {
        if (!selectedPlatformId && filteredPlatforms.length > 0) {
            return filteredPlatforms[0];
        }
        return allPlatforms.find(p => p.plat_id === selectedPlatformId) || (filteredPlatforms.length > 0 ? filteredPlatforms[0] : null);
    }, [allPlatforms, filteredPlatforms, selectedPlatformId]);

    // Fetch direct platform files for selected platform
    const { data: directPlatData, isLoading: isLoadingPlatAtts } = useSWR(
        activePlatform ? `/api/attachment/platform/${activePlatform.plat_id}` : null,
        fetcher
    );
    const platformFiles: Attachment[] = useMemo(() => directPlatData?.data || [], [directPlatData]);

    // Fetch component files for selected platform
    const { data: compAttsData, isLoading: isLoadingCompAtts } = useSWR(
        activePlatform ? `/api/attachment/component/${activePlatform.plat_id}?structure_id=${activePlatform.plat_id}` : null,
        fetcher
    );
    const componentFiles: any[] = useMemo(() => compAttsData?.data || [], [compAttsData]);

    if (isLoadingPlatforms) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Tree View...</p>
            </div>
        );
    }

    return (
        <div className="flex h-full gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Left Sidebar Pane */}
            <div className="w-80 flex-shrink-0 flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 shadow-sm overflow-hidden h-[calc(100vh-12rem)]">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Layers className="h-4 w-4 text-blue-500" />
                        Platform Assets
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {filteredPlatforms.length}
                    </span>
                </div>
                <ScrollArea className="flex-1">
                    <div className="p-3">
                        {Object.keys(groupedPlatforms).length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                                <Filter className="h-8 w-8 mb-2 opacity-20" />
                                <p className="font-bold text-xs">No platforms found</p>
                            </div>
                        ) : (
                            Object.entries(groupedPlatforms).map(([field, platforms]) => (
                                <Collapsible key={field} defaultOpen className="mb-4">
                                    <CollapsibleTrigger asChild>
                                        <Button variant="ghost" className="w-full flex items-center justify-start p-2 h-auto hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg group">
                                            <ChevronDown className="h-4 w-4 shrink-0 mr-2 text-slate-400 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                                            <MapPin className="h-4 w-4 mr-2 text-blue-500" />
                                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200 uppercase tracking-wide truncate">{field}</span>
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="pl-4 mt-1 border-l ml-3 border-slate-200 dark:border-slate-800 space-y-1">
                                        {platforms.map(platform => {
                                            const totalPlatformAttachments = platformCounts[platform.plat_id] || 0;
                                            const isSelected = activePlatform?.plat_id === platform.plat_id;

                                            return (
                                                <Button
                                                    key={platform.plat_id}
                                                    variant="ghost"
                                                    onClick={() => setSelectedPlatformId(platform.plat_id)}
                                                    className={cn(
                                                        "w-full justify-start text-left px-3 py-2 h-auto rounded-md transition-all",
                                                        isSelected
                                                            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium border border-blue-100 dark:border-blue-800"
                                                            : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                    )}
                                                >
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <span className="truncate text-sm font-semibold">{platform.title}</span>
                                                        <span className="text-[10px] uppercase tracking-wider opacity-70 truncate">{platform.ptype || "Platform"}</span>
                                                    </div>
                                                    {totalPlatformAttachments > 0 && (
                                                        <div className="flex items-center gap-1 shrink-0 ml-2 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded shadow-sm border border-slate-200 dark:border-slate-700">
                                                            <Paperclip className="h-3 w-3 text-blue-500" />
                                                            <span className="text-[10px] font-bold">{totalPlatformAttachments}</span>
                                                        </div>
                                                    )}
                                                </Button>
                                            );
                                        })}
                                    </CollapsibleContent>
                                </Collapsible>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Right Main Content Pane */}
            <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 shadow-sm overflow-hidden h-[calc(100vh-12rem)] flex flex-col">
                {!activePlatform ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                        <Box className="h-16 w-16 mb-4 opacity-20" />
                        <h3 className="text-xl font-medium text-slate-600 dark:text-slate-300 mb-2">No Platform Selected</h3>
                        <p className="text-sm text-center max-w-sm">Select a platform from the left list to view, edit, and add attachments.</p>
                    </div>
                ) : (
                    <div className="flex flex-col h-full overflow-hidden">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white dark:bg-slate-800 border shadow-sm h-8">
                                        <MapPin className="h-3.5 w-3.5 text-blue-500" />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{activePlatform.pfield}</span>
                                    </div>
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-none">
                                        {activePlatform.title}
                                    </h2>
                                    <span className="text-xs text-slate-500 border-l border-slate-300 dark:border-slate-700 pl-3">
                                        {activePlatform.ptype || "Standard Platform"}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Category Filter Chips */}
                                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
                                        {(["ALL", "PHOTO", "VIDEO", "DOCUMENT", "OTHER"] as const).map((cat) => {
                                            const label = cat === "ALL" ? "All Types" : ATTACHMENT_CATEGORY_LABELS[cat];
                                            const isActive = categoryFilter === cat;
                                            return (
                                                <button
                                                    key={cat}
                                                    onClick={() => setCategoryFilter(cat)}
                                                    className={cn(
                                                        "px-2.5 py-1 text-xs font-semibold rounded-md transition-all",
                                                        isActive
                                                            ? "bg-white dark:bg-slate-950 text-blue-600 dark:text-blue-400 shadow-sm font-bold"
                                                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                                                    )}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <Button
                                        size="sm"
                                        className="h-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                                        onClick={() => openSlideOver(null, { sourceType: "platform", sourceId: activePlatform.plat_id })}
                                    >
                                        <Plus className="mr-1 h-3.5 w-3.5" /> Add
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex-1 overflow-hidden p-6 pb-0 flex flex-col">
                            <Tabs defaultValue="inspection" className="h-full flex flex-col">
                                <TabsList className="grid w-full grid-cols-3 mb-4 shrink-0 bg-slate-100/80 dark:bg-slate-900 h-11 p-1 border border-slate-200/50 dark:border-slate-800">
                                    <TabsTrigger
                                        value="inspection"
                                        className="h-full data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm rounded-md transition-all font-semibold"
                                    >
                                        <ClipboardList className="h-4 w-4 mr-2" />
                                        Inspection Attachments
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="platform"
                                        className="h-full data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md transition-all font-semibold"
                                    >
                                        <Paperclip className="h-4 w-4 mr-2" />
                                        Platform Files ({platformFiles.length})
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="components"
                                        className="h-full data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-md transition-all font-semibold"
                                    >
                                        <Box className="h-4 w-4 mr-2" />
                                        Component Files ({componentFiles.length})
                                    </TabsTrigger>
                                </TabsList>

                                {/* Inspection Attachments Tab (Includes Current & Previous Jobpacks filter) */}
                                <InspectionAttachmentsTab
                                    platformId={activePlatform.plat_id}
                                    categoryFilter={categoryFilter}
                                />

                                {/* Platform Attachments Tab */}
                                <TabsContent value="platform" className="flex-1 overflow-hidden mt-0 border-none outline-none data-[state=inactive]:hidden flex flex-col">
                                    <ScrollArea className="flex-1 h-full pr-4 pb-4">
                                        {isLoadingPlatAtts ? (
                                            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                                                <Loader2 className="h-8 w-8 animate-spin mb-4 text-blue-500" />
                                                <p className="text-sm font-medium">Loading platform files...</p>
                                            </div>
                                        ) : (() => {
                                            let items = platformFiles;
                                            if (categoryFilter !== "ALL") {
                                                items = items.filter(a => getAttachmentCategory(a) === categoryFilter);
                                            }

                                            if (items.length === 0) {
                                                return (
                                                    <div className="flex flex-col items-center justify-center p-12 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl mt-4">
                                                        <Paperclip className="h-10 w-10 mb-2 opacity-20" />
                                                        <p className="font-bold text-sm">No platform files found</p>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="mt-3"
                                                            onClick={() => openSlideOver(null, { sourceType: "platform", sourceId: activePlatform.plat_id })}
                                                        >
                                                            <Plus className="mr-1 h-3.5 w-3.5" /> Add Platform File
                                                        </Button>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div className="pb-8">
                                                    <DataTable
                                                        columns={attachmentColumns}
                                                        data={items}
                                                        disableRowClick={true}
                                                    />
                                                </div>
                                            );
                                        })()}
                                    </ScrollArea>
                                </TabsContent>

                                {/* Components Attachments Tab */}
                                <TabsContent value="components" className="flex-1 overflow-hidden mt-0 border-none outline-none data-[state=inactive]:hidden flex flex-col">
                                    <ScrollArea className="flex-1 h-full pr-4 pb-4">
                                        {isLoadingCompAtts ? (
                                            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                                                <Loader2 className="h-8 w-8 animate-spin mb-4 text-indigo-500" />
                                                <p className="text-sm font-medium">Loading component files...</p>
                                            </div>
                                        ) : (() => {
                                            let items = componentFiles;
                                            if (categoryFilter !== "ALL") {
                                                items = items.filter(a => getAttachmentCategory(a) === categoryFilter);
                                            }

                                            if (items.length === 0) {
                                                return (
                                                    <div className="flex flex-col items-center justify-center p-12 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl mt-4">
                                                        <Box className="h-10 w-10 mb-2 opacity-20" />
                                                        <p className="font-bold text-sm">No component attachments found</p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="pb-8">
                                                    <div className="border border-slate-200/60 dark:border-slate-800/60 rounded-2xl overflow-hidden shadow-sm">
                                                        <DataTable
                                                            columns={globalAttachments}
                                                            data={items}
                                                            disableRowClick={true}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </ScrollArea>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Inspection Attachments Tab ───────────────────────────────────────────────

function InspectionAttachmentsTab({
    platformId,
    categoryFilter,
}: {
    platformId: number;
    categoryFilter: AttachmentCategory | "ALL";
}) {
    const { openSlideOver } = useAttachmentStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedJobpackFilter, setSelectedJobpackFilter] = useState<string>("CURRENT");
    const [lightboxItem, setLightboxItem] = useState<{ url: string; name: string; isVideo: boolean; title?: string } | null>(null);
    const [editingAttachment, setEditingAttachment] = useState<any | null>(null);
    const [failedImageIds, setFailedImageIds] = useState<Record<string | number, boolean>>({});
    const [itemToDelete, setItemToDelete] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { data, isLoading, mutate: mutateInspectionAttachments } = useSWR(
        platformId ? `/api/attachment/inspection?platform_id=${platformId}` : null,
        fetcher
    );

    const handleConfirmDelete = async () => {
        if (!itemToDelete) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/attachment?id=${encodeURIComponent(itemToDelete.id)}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Failed to delete attachment");
            }
            refreshAttachmentCaches();
            mutateInspectionAttachments();
            toast.success("Attachment deleted successfully");
            setItemToDelete(null);
        } catch (err: any) {
            console.error("Failed to delete attachment:", err);
            toast.error("Failed to delete attachment: " + err.message);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSaveAttachment = async (updated: any) => {
        if (!updated) return;
        try {
            const supabase = createClient();
            const { error } = await supabase
                .from('attachment')
                .update({
                    name: updated.title || updated.name,
                    meta: {
                        ...(updated.meta || {}),
                        description: updated.description,
                        title: updated.title,
                        type: updated.type || 'PHOTO',
                    }
                })
                .eq('id', updated.id);
            if (error) throw error;
            refreshAttachmentCaches();
            mutateInspectionAttachments();
            toast.success("Attachment visual updates saved successfully");
            setEditingAttachment(null);
        } catch (err: any) {
            console.error("Failed to save attachment:", err);
            toast.error("Failed to save attachment: " + err.message);
        }
    };

    const allItems: any[] = useMemo(() => data?.data || [], [data]);

    // Discover unique jobpacks for this platform, sorted by latest inspection date / jobpack id
    const { availableJobpacks, latestJobpackName } = useMemo(() => {
        const jps = new Map<string, { name: string; latestDate: string; count: number }>();
        allItems.forEach((item) => {
            const jpName = item.jobpack_name || "Unassigned Jobpack";
            const date = item.inspection_date || item.cr_date || "";
            const current = jps.get(jpName) || { name: jpName, latestDate: "", count: 0 };
            current.count += 1;
            if (date > current.latestDate) current.latestDate = date;
            jps.set(jpName, current);
        });

        const list = Array.from(jps.values()).sort((a, b) => b.latestDate.localeCompare(a.latestDate));
        return {
            availableJobpacks: list,
            latestJobpackName: list.length > 0 ? list[0].name : "Current",
        };
    }, [allItems]);

    // Filter by Jobpack, Search, and Category
    const filtered = useMemo(() => {
        return allItems.filter((item) => {
            // Category filter
            if (categoryFilter !== "ALL" && getAttachmentCategory(item) !== categoryFilter) {
                return false;
            }

            // Jobpack filter: "CURRENT", "ALL", or specific jobpack name
            const itemJp = item.jobpack_name || "Unassigned Jobpack";
            if (selectedJobpackFilter === "CURRENT") {
                if (latestJobpackName && itemJp !== latestJobpackName) return false;
            } else if (selectedJobpackFilter !== "ALL") {
                if (itemJp !== selectedJobpackFilter) return false;
            }

            // Search filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matched =
                    (item.component_q_id || "").toLowerCase().includes(q) ||
                    (item.inspection_type_name || "").toLowerCase().includes(q) ||
                    (item.inspection_type_code || "").toLowerCase().includes(q) ||
                    (item.jobpack_name || "").toLowerCase().includes(q) ||
                    (item.name || "").toLowerCase().includes(q) ||
                    (item.sow_report_no || "").toLowerCase().includes(q);
                if (!matched) return false;
            }

            return true;
        });
    }, [allItems, categoryFilter, selectedJobpackFilter, latestJobpackName, searchQuery]);

    // Group filtered items: Jobpack -> Discipline (ROV/Diving) -> Inspection Type
    const grouped = useMemo(() => {
        return filtered.reduce((acc: any, item: any) => {
            const jobpack = item.jobpack_name || "Unassigned Jobpack";
            const discipline = item.rov_job_id ? "ROV Inspection" : (item.dive_job_id ? "Diving Inspection" : "General Inspection");
            const inspType = item.inspection_type_name || item.inspection_type_code || "General Inspection";

            if (!acc[jobpack]) acc[jobpack] = {};
            if (!acc[jobpack][discipline]) acc[jobpack][discipline] = {};
            if (!acc[jobpack][discipline][inspType]) acc[jobpack][discipline][inspType] = [];

            acc[jobpack][discipline][inspType].push(item);
            return acc;
        }, {});
    }, [filtered]);

    return (
        <TabsContent value="inspection" className="flex-1 overflow-hidden mt-0 border-none outline-none data-[state=inactive]:hidden flex flex-col">
            {/* Filter Bar: Jobpack Scope + Search */}
            <div className="mb-4 shrink-0 flex flex-col sm:flex-row items-center gap-3">
                {/* Jobpack scope selector */}
                <div className="w-full sm:w-64">
                    <Select value={selectedJobpackFilter} onValueChange={setSelectedJobpackFilter}>
                        <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-9 text-xs font-semibold">
                            <SelectValue placeholder="Jobpack scope" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                            <SelectItem value="CURRENT" className="font-bold text-blue-600 dark:text-blue-400">
                                Current Jobpack ({latestJobpackName || "Latest"})
                            </SelectItem>
                            <SelectItem value="ALL" className="font-bold">
                                All Jobpacks (Current & Previous)
                            </SelectItem>
                            {availableJobpacks.map((jp) => (
                                <SelectItem key={jp.name} value={jp.name}>
                                    {jp.name} ({jp.count} files)
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Search */}
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search by component, inspection type, jobpack, file name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-9 text-xs"
                    />
                </div>
            </div>

            <ScrollArea className="flex-1 h-full pr-4 pb-4">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                        <Loader2 className="h-8 w-8 animate-spin mb-4 text-emerald-500" />
                        <p className="text-sm font-medium">Loading inspection attachments...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl mt-4">
                        <ClipboardList className="h-10 w-10 mb-2 opacity-20" />
                        <p className="font-bold text-sm">No inspection attachments found</p>
                        <p className="text-xs mt-1 text-center max-w-xs text-slate-500">
                            {selectedJobpackFilter !== "ALL"
                                ? "Try selecting 'All Jobpacks' or adjusting your search filters."
                                : "Inspection attachments are recorded during field inspections."}
                        </p>
                    </div>
                ) : (
                    <div className="pb-8 space-y-4">
                        {Object.entries(grouped).map(([jobpack, disciplines]: [string, any]) => (
                            <Collapsible key={jobpack} defaultOpen className="border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/30 dark:bg-slate-900/10 shadow-sm overflow-hidden">
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" className="w-full flex items-center justify-start p-3 h-auto hover:bg-slate-100 dark:hover:bg-slate-800 group bg-slate-50 dark:bg-slate-900/50 rounded-none border-b border-slate-200 dark:border-slate-800">
                                        <ChevronDown className="h-5 w-5 shrink-0 mr-3 text-slate-400 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                                        <Folder className="h-5 w-5 mr-3 text-emerald-500" />
                                        <div className="flex items-center gap-2 flex-1 text-left">
                                            <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{jobpack}</span>
                                            {jobpack === latestJobpackName && (
                                                 <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs font-medium text-slate-400 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2 py-1 rounded-md shadow-sm">
                                            {Object.values(disciplines).reduce((sum: number, types: any) => sum + Object.values(types).flat().length, 0)} items
                                        </span>
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="p-3 space-y-3">
                                    {Object.entries(disciplines).map(([discipline, inspTypes]: [string, any]) => (
                                        <Collapsible key={discipline} defaultOpen className="border border-slate-200/60 dark:border-slate-800/60 rounded-lg bg-white/50 dark:bg-slate-950/50 overflow-hidden shadow-sm">
                                            <CollapsibleTrigger asChild>
                                                <Button variant="ghost" className="w-full flex items-center justify-start p-2.5 h-auto hover:bg-slate-50 dark:hover:bg-slate-900 group rounded-none border-b border-slate-100 dark:border-slate-800 bg-white/30 dark:bg-slate-900/30">
                                                    <ChevronDown className="h-4 w-4 shrink-0 mr-2 text-slate-400 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                                                    <div className={cn(
                                                        "h-2 w-2 rounded-full mr-2",
                                                        discipline.includes("ROV") ? "bg-blue-500" : "bg-emerald-500"
                                                    )} />
                                                    <span className="font-black text-xs text-slate-800 dark:text-slate-200 flex-1 text-left uppercase tracking-wider">{discipline}</span>
                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded shadow-sm">
                                                        {Object.values(inspTypes).flat().length}
                                                    </span>
                                                </Button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="p-2 space-y-2">
                                                {Object.entries(inspTypes).map(([inspType, items]: [string, any]) => {
                                                    // Group items belonging to the same component together
                                                    const componentGroups: { key: string; component_q_id: string | null; component_description?: string; items: any[] }[] = [];
                                                    const compMap = new Map<string, (typeof componentGroups)[0]>();
                                                    items.forEach((item: any) => {
                                                        const key = item.component_q_id || "__NO_COMP__";
                                                        if (!compMap.has(key)) {
                                                            const grp = {
                                                                key,
                                                                component_q_id: item.component_q_id || null,
                                                                component_description: item.component_description,
                                                                items: [],
                                                            };
                                                            compMap.set(key, grp);
                                                            componentGroups.push(grp);
                                                        }
                                                        compMap.get(key)!.items.push(item);
                                                    });

                                                    return (
                                                        <Collapsible key={inspType} defaultOpen className="border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                                                            <CollapsibleTrigger asChild>
                                                                <Button variant="ghost" className="w-full flex items-center justify-start p-2 h-auto hover:bg-slate-50 dark:hover:bg-slate-900 group rounded-none border-b border-slate-100 dark:border-slate-800">
                                                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 mr-2 text-slate-400 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                                                                    <span className="font-bold text-[12px] text-slate-600 dark:text-slate-300 flex-1 text-left">{inspType}</span>
                                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded shadow-sm">
                                                                        {items.length}
                                                                    </span>
                                                                </Button>
                                                            </CollapsibleTrigger>
                                                            <CollapsibleContent>
                                                                <div className="overflow-x-auto w-full border-2 border-slate-200 dark:border-slate-800 rounded-xl shadow-sm bg-white dark:bg-slate-950">
                                                                    {/* Table Header with Distinct Column Borders */}
                                                                    <div
                                                                        className="grid grid-cols-[1.1fr_105px_140px_65px_2.3fr_95px] divide-x divide-slate-700/80 bg-slate-900 dark:bg-slate-950 text-slate-100 dark:text-slate-200 border-b-2 border-slate-700 text-[11px] font-black uppercase tracking-wider w-full"
                                                                    >
                                                                        <div className="px-4 py-3 flex items-center justify-center">
                                                                            <span>Component</span>
                                                                        </div>
                                                                        <div className="px-4 py-3 flex items-center gap-1.5">
                                                                            <Calendar className="h-3.5 w-3.5 text-blue-400" />
                                                                            <span>Date</span>
                                                                        </div>
                                                                        <div className="px-4 py-3 flex items-center gap-1.5">
                                                                            <FileText className="h-3.5 w-3.5 text-indigo-400" />
                                                                            <span>SOW Report</span>
                                                                        </div>
                                                                        <div className="px-4 py-3 flex items-center justify-center">
                                                                            <span>Status</span>
                                                                        </div>
                                                                        <div className="px-4 py-3 flex items-center gap-1.5">
                                                                            <Paperclip className="h-3.5 w-3.5 text-emerald-400" />
                                                                            <span>Attachment</span>
                                                                        </div>
                                                                        <div className="px-4 py-3 flex items-center justify-center">
                                                                            <span>Actions</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Table Body with Merged & Centered Component Cells */}
                                                                    <div className="grid grid-cols-[1.1fr_105px_140px_65px_2.3fr_95px] text-xs items-stretch w-full">
                                                                        {componentGroups.map((group, groupIdx) => {
                                                                            return (
                                                                                <Fragment key={group.key}>
                                                                                    {/* 1. Merged & Centered Component Cell */}
                                                                                    <div
                                                                                        style={{ gridRow: `span ${group.items.length}` }}
                                                                                        className={cn(
                                                                                            "px-4 py-4 min-w-0 flex flex-col items-center justify-center text-center border-r border-b border-slate-200 dark:border-slate-800 transition-colors",
                                                                                            groupIdx % 2 === 0
                                                                                                ? "bg-slate-50/90 dark:bg-slate-900/60"
                                                                                                : "bg-slate-100/60 dark:bg-slate-900/90"
                                                                                        )}
                                                                                    >
                                                                                        {group.component_q_id ? (
                                                                                            <div className="flex flex-col items-center max-w-full">
                                                                                                <span className="font-bold text-slate-900 dark:text-slate-100 text-[13px] tracking-tight truncate max-w-full">
                                                                                                    {group.component_q_id}
                                                                                                </span>
                                                                                                {group.component_description && (
                                                                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-tight">
                                                                                                        {group.component_description}
                                                                                                    </span>
                                                                                                )}
                                                                                                {group.items.length > 1 && (
                                                                                                    <span className="mt-2 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900 shadow-2xs">
                                                                                                        {group.items.length} attachments
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        ) : (
                                                                                            <div className="flex flex-col items-center">
                                                                                                <span className="text-slate-400 italic text-xs">No component</span>
                                                                                                {group.items.length > 1 && (
                                                                                                    <span className="mt-1 text-[9px] font-bold text-slate-400 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-2xs">
                                                                                                        {group.items.length} files
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>

                                                                                    {/* Rows for each attachment in this component */}
                                                                                    {group.items.map((item, itemIdx) => {
                                                                                        const publicUrl = getAttachmentUrl(item);
                                                                                        const { fileUrl: rawFileUrl, fileName } = processAttachmentUrl(item);
                                                                                        const fileUrl = publicUrl || rawFileUrl;
                                                                                        const category = getAttachmentCategory(item);
                                                                                        const isImage = category === "PHOTO";
                                                                                        const isVideo = category === "VIDEO";
                                                                                        const baseName = item.anomaly_ref_no
                                                                                            ? `Anomaly ${item.anomaly_ref_no} - ${fileName}`
                                                                                            : fileName;
                                                                                        const displayText = truncateText(baseName, 70);
                                                                                        const openVisualEditor = () => {
                                                                                            if (isVideo && fileUrl) {
                                                                                                setLightboxItem({ url: fileUrl, name: fileName, isVideo: true, title: item.name || baseName });
                                                                                            } else if (isImage) {
                                                                                                setEditingAttachment({
                                                                                                    ...item,
                                                                                                    title: item.name || fileName,
                                                                                                    name: fileName,
                                                                                                    previewUrl: fileUrl,
                                                                                                    path: item.path,
                                                                                                    type: category,
                                                                                                    isExisting: true,
                                                                                                });
                                                                                            } else if (fileUrl) {
                                                                                                window.open(fileUrl, '_blank');
                                                                                            }
                                                                                        };

                                                                                        const rowBg = itemIdx % 2 === 0
                                                                                            ? "bg-white dark:bg-slate-950"
                                                                                            : "bg-slate-50/50 dark:bg-slate-900/40";

                                                                                        return (
                                                                                            <Fragment key={item.id}>
                                                                                                {/* 2. Date */}
                                                                                                <div className={cn("px-3 py-3 min-w-0 flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium border-r border-b border-slate-200 dark:border-slate-800", rowBg)}>
                                                                                                    <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                                                                    <span className="truncate font-mono text-[11px]">
                                                                                                        {item.inspection_date
                                                                                                            ? format(new Date(item.inspection_date), "dd/MM/yyyy")
                                                                                                            : "—"}
                                                                                                    </span>
                                                                                                </div>

                                                                                                {/* 3. SOW Report */}
                                                                                                <div className={cn("px-4 py-3.5 min-w-0 flex items-center border-r border-b border-slate-200 dark:border-slate-800", rowBg)}>
                                                                                                    {item.sow_report_no ? (
                                                                                                        <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-1 rounded-md border border-indigo-200 dark:border-indigo-800 truncate block shadow-2xs" title={item.sow_report_no}>
                                                                                                            {item.sow_report_no}
                                                                                                        </span>
                                                                                                    ) : (
                                                                                                        <span className="text-slate-300 dark:text-slate-600 italic text-[10px]">—</span>
                                                                                                    )}
                                                                                                </div>

                                                                                                {/* 4. Status / Anomaly */}
                                                                                                <div className={cn("px-4 py-3.5 flex justify-center items-center border-r border-b border-slate-200 dark:border-slate-800", rowBg)}>
                                                                                                    {item.has_anomaly ? (
                                                                                                        <div title="Anomaly Found" className="flex items-center justify-center h-7 w-7 rounded-full bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 shadow-2xs">
                                                                                                            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                                                                                        </div>
                                                                                                    ) : item.inspection_status === "COMPLETED" ? (
                                                                                                        <div title="Completed" className="flex items-center justify-center h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                                                                                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                                                                                        </div>
                                                                                                    ) : (
                                                                                                        <div title="In Progress / Draft" className="flex items-center justify-center h-7 w-7 rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 shadow-2xs">
                                                                                                            <FileClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>

                                                                                                {/* 5. Attachment Column */}
                                                                                                <div
                                                                                                    onClick={openVisualEditor}
                                                                                                    className={cn("px-4 py-2.5 min-w-0 flex items-center gap-3 cursor-pointer group/attach hover:bg-blue-50/80 dark:hover:bg-blue-950/40 transition-colors select-none border-r border-b border-slate-200 dark:border-slate-800", rowBg)}
                                                                                                    title="Click to open attachment window"
                                                                                                >
                                                                                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                                                        {/* Thumbnail Preview Tile */}
                                                                                                        {isImage && fileUrl ? (
                                                                                                            <div
                                                                                                                className={cn(
                                                                                                                    "relative h-11 w-11 rounded-lg border-2 overflow-hidden bg-slate-100 dark:bg-slate-900 shrink-0 group-hover/attach:border-blue-500 transition-all shadow-xs",
                                                                                                                    failedImageIds[item.id]
                                                                                                                        ? "border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40"
                                                                                                                        : "border-slate-200 dark:border-slate-700"
                                                                                                                )}
                                                                                                            >
                                                                                                                {failedImageIds[item.id] ? (
                                                                                                                    <div className="h-full w-full flex items-center justify-center text-amber-600 dark:text-amber-400">
                                                                                                                        <AlertTriangle className="h-5 w-5" />
                                                                                                                    </div>
                                                                                                                ) : (
                                                                                                                    <>
                                                                                                                        <img
                                                                                                                            src={fileUrl}
                                                                                                                            alt={fileName}
                                                                                                                            onError={() => setFailedImageIds(prev => ({ ...prev, [item.id]: true }))}
                                                                                                                            className="h-full w-full object-cover group-hover/attach:scale-110 transition-transform duration-200"
                                                                                                                        />
                                                                                                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/attach:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                                                                                            <Eye className="h-4 w-4" />
                                                                                                                        </div>
                                                                                                                    </>
                                                                                                                )}
                                                                                                            </div>
                                                                                                        ) : isVideo && fileUrl ? (
                                                                                                            <div className="h-11 w-11 rounded-lg border-2 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 group-hover/attach:scale-105 transition-transform shadow-xs">
                                                                                                                <Film className="h-5 w-5" />
                                                                                                            </div>
                                                                                                        ) : (
                                                                                                            <div className="h-11 w-11 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 shrink-0 shadow-2xs">
                                                                                                                <Paperclip className="h-5 w-5" />
                                                                                                            </div>
                                                                                                        )}

                                                                                                        {/* File Details */}
                                                                                                        <div className="flex flex-col min-w-0 flex-1">
                                                                                                            <span
                                                                                                                className="text-blue-600 dark:text-blue-400 font-semibold group-hover/attach:text-blue-800 dark:group-hover/attach:text-blue-300 flex items-center gap-1.5 text-xs truncate transition-colors"
                                                                                                                title={baseName}
                                                                                                            >
                                                                                                                <span className="truncate">{displayText}</span>
                                                                                                            </span>

                                                                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                                                                {item.name && item.name !== fileName && (
                                                                                                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                                                                                                                        {item.name}
                                                                                                                    </span>
                                                                                                                )}
                                                                                                                <span className={cn(
                                                                                                                    "text-[9px] font-black uppercase px-1.5 py-0.2 rounded tracking-wider",
                                                                                                                    isImage ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" :
                                                                                                                    isVideo ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300" :
                                                                                                                    "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                                                                                )}>
                                                                                                                    {category}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                </div>

                                                                                                {/* 6. Actions */}
                                                                                                <div className={cn("px-2 py-3 flex items-center justify-center gap-1.5 border-b border-slate-200 dark:border-slate-800", rowBg)}>
                                                                                                    <Button
                                                                                                        variant="outline"
                                                                                                        size="icon"
                                                                                                        className="h-7 w-7 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 border-slate-200 dark:border-slate-800 shadow-2xs transition-colors"
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            openSlideOver(item);
                                                                                                        }}
                                                                                                        title="Edit attachment"
                                                                                                    >
                                                                                                        <Edit2 className="h-3.5 w-3.5" />
                                                                                                    </Button>
                                                                                                    <Button
                                                                                                        variant="outline"
                                                                                                        size="icon"
                                                                                                        className="h-7 w-7 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 border-slate-200 dark:border-slate-800 hover:border-red-300 dark:hover:border-red-800 shadow-2xs transition-colors"
                                                                                                        onClick={(e) => {
                                                                                                            e.stopPropagation();
                                                                                                            setItemToDelete(item);
                                                                                                        }}
                                                                                                        title="Delete attachment"
                                                                                                    >
                                                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                                                    </Button>
                                                                                                </div>
                                                                                            </Fragment>
                                                                                        );
                                                                                    })}
                                                                                </Fragment>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </CollapsibleContent>
                                                        </Collapsible>
                                                    );
                                                })}
                                            </CollapsibleContent>
                                        </Collapsible>
                                    ))}
                                </CollapsibleContent>
                            </Collapsible>
                        ))}
                    </div>
                )}
            </ScrollArea>

            {/* Inspection Visual Viewer & Annotator Dialog */}
            {editingAttachment && (
                <AttachmentEditorDialog
                    open={!!editingAttachment}
                    onOpenChange={(open) => !open && setEditingAttachment(null)}
                    attachment={editingAttachment}
                    onSave={handleSaveAttachment}
                />
            )}

            {/* Fullscreen Lightbox Modal Dialog */}
            <Dialog open={!!lightboxItem} onOpenChange={(open) => !open && setLightboxItem(null)}>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-slate-950 border-slate-800 text-white shadow-2xl">
                    <DialogHeader className="p-4 bg-slate-900 border-b border-slate-800 flex flex-row items-center justify-between">
                        <div className="flex flex-col">
                            <DialogTitle className="text-sm font-bold text-white truncate max-w-lg">
                                {lightboxItem?.title || lightboxItem?.name || "Picture Preview"}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-400 font-mono mt-0.5">
                                {lightboxItem?.name}
                            </DialogDescription>
                        </div>
                        {lightboxItem?.url && (
                            <div className="flex items-center gap-2 pr-6">
                                <Button
                                    size="sm"
                                    className="h-7 text-xs bg-blue-600 text-white hover:bg-blue-700 font-semibold"
                                    onClick={() => {
                                        const att = allItems.find(a => a.name === lightboxItem.name || a.path === lightboxItem.url);
                                        if (att) {
                                            setLightboxItem(null);
                                            setEditingAttachment({
                                                ...att,
                                                title: att.name || lightboxItem.name,
                                                name: lightboxItem.name,
                                                previewUrl: lightboxItem.url,
                                                path: att.path,
                                                type: "PHOTO",
                                                isExisting: true,
                                            });
                                        }
                                    }}
                                >
                                    <ImageIcon className="h-3.5 w-3.5 mr-1" /> Open Visual Viewer
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs bg-slate-800 border-slate-700 text-white hover:bg-slate-700"
                                    onClick={() => window.open(lightboxItem.url, '_blank')}
                                >
                                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open in New Tab
                                </Button>
                            </div>
                        )}
                    </DialogHeader>
                    <div className="p-6 bg-slate-950 flex items-center justify-center min-h-[400px] max-h-[75vh] overflow-auto">
                        {lightboxItem?.isVideo ? (
                            <video src={lightboxItem.url} controls autoPlay className="w-full max-h-[70vh] rounded-lg shadow-lg" />
                        ) : (
                            <img
                                src={lightboxItem?.url}
                                alt={lightboxItem?.name || "Preview"}
                                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg border border-slate-800"
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal Dialog */}
            <Dialog open={!!itemToDelete} onOpenChange={(open) => !open && !isDeleting && setItemToDelete(null)}>
                <DialogContent className="max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-2xl rounded-xl">
                    <DialogHeader className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                                Delete Attachment
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                            Are you sure you want to delete <strong className="text-slate-800 dark:text-slate-200 font-semibold">{itemToDelete?.name || itemToDelete?.title || "this attachment"}</strong>? This action will remove the file from inspection records.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-2 pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isDeleting}
                            onClick={() => setItemToDelete(null)}
                            className="h-8 text-xs font-semibold"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            disabled={isDeleting}
                            onClick={handleConfirmDelete}
                            className="h-8 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span>Deleting...</span>
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Delete</span>
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TabsContent>
    );
}
