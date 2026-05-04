"use client";

import { useAttachmentStore } from "@/stores/attachment-store";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronDown, FileText, Database, Box, Loader2, Paperclip, Search, Filter, ClipboardList, AlertTriangle, CheckCircle2, FileClock, ExternalLink, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { DataTable } from "../data-table/data-table";
import { attachments as attachmentColumns, globalAttachments } from "../data-table/columns";
import { AttachmentDialog } from "../dialogs/attachment-dialog";
import { Platform, Attachment } from "../data-table/columns";
import { processAttachmentUrl, truncateText } from "@/utils/storage";
import { format } from "date-fns";



interface Component {
    comp_id: string; // This is the ID used for display? No, database likely uses an auto-int or string ID.
    // Let's check api/structure-components response. It returns structure_components table rows.
    // Assuming 'id' is the primary key.
    id: number;
    description: string;
    component_type: string;
    q_id: string;
}

// Helper to filter attachments
const getAttachmentsForSource = (attachments: Attachment[] | undefined, type: string, id: number) => {
    if (!attachments) return [];
    return attachments.filter(a => a.source_type === type && a.source_id === id);
};

// Component for a single Structure Component Node
const ComponentNode = ({ component, allAttachments }: { component: Component; allAttachments: Attachment[] }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Filter attachments for this component
    // Assuming source_type is 'structure_component' or similar. 
    // We need to match what's in the DB. Let's assume 'component' or 'structure_component'.
    // Given previous `source_type` usage in other files, 'component' is a likely candidate, or 'structure_component'. 
    // I'll try 'structure_component' based on the table name.
    const compAttachments = allAttachments.filter((a: any) => 
        (a.source_type?.toLowerCase() === 'component' || a.source_type?.toLowerCase() === 'structure_component') && a.source_id === component.id
        || a.component_id === component.id
    );

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="ml-6 border-l pl-4 my-2">
            <div className="flex items-center justify-between group">
                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 h-auto w-full justify-start text-left font-normal">
                        <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform duration-200 text-slate-400", isOpen && "rotate-90")} />
                        <Box className="h-4 w-4 mr-2 text-indigo-500" />
                        <span className="truncate flex-1">
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{component.q_id || component.comp_id}</span>
                            <span className="ml-2 text-xs text-slate-400">{component.description}</span>
                        </span>
                        {compAttachments.length > 0 && (
                            <span className="ml-2 bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                {compAttachments.length}
                            </span>
                        )}
                    </Button>
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="pt-2">
                {compAttachments.length === 0 ? (
                    <div className="text-xs text-slate-400 italic pl-6 py-2">No attachments</div>
                ) : (
                    <div className="pl-2">
                        <DataTable
                            columns={globalAttachments}
                            data={compAttachments}
                            disableRowClick={true}
                        // Simplified table or reusing the main one? 
                        // The main one might be too wide. Let's use it for now and see.
                        />
                    </div>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
};

// Component for a Platform Node
const PlatformNode = ({ platform, allAttachments }: { platform: Platform; allAttachments: Attachment[] }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Fetch components when expanded to save initial load
    const { data: componentsData, isLoading: isLoadingComponents } = useSWR(
        isOpen ? `/api/structure-components/${platform.plat_id}` : null,
        fetcher
    );

    const platformAttachments = getAttachmentsForSource(allAttachments, 'platform', platform.plat_id);
    const components = componentsData?.data || [];

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-2 border rounded-xl overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
            <div className="flex items-center justify-between p-2 bg-slate-50/50 dark:bg-slate-900/50">
                <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full flex justify-between hover:bg-slate-100 dark:hover:bg-slate-800 p-2 h-auto">
                        <div className="flex items-center gap-3">
                            <ChevronRight className={cn("h-5 w-5 shrink-0 transition-transform duration-200 text-slate-400", isOpen && "rotate-90")} />
                            <div className="flex flex-col items-start text-left">
                                <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{platform.title}</span>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider">
                                    <span>{platform.pfield}</span>
                                    <span>•</span>
                                    <span>{platform.ptype || "Platform"}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {platformAttachments.length > 0 && (
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white dark:bg-slate-800 border shadow-sm">
                                    <Paperclip className="h-3 w-3 text-blue-500" />
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{platformAttachments.length}</span>
                                </div>
                            )}
                        </div>
                    </Button>
                </CollapsibleTrigger>
            </div>

            <CollapsibleContent>
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-6">
                    {/* Platform Attachments Section */}
                    <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Paperclip className="h-3 w-3" />
                            Platform Attachments
                        </h4>
                        {platformAttachments.length === 0 ? (
                            <div className="text-sm text-slate-500 italic px-2">No direct attachments</div>
                        ) : (
                            <DataTable
                                columns={attachmentColumns}
                                data={platformAttachments}
                                disableRowClick={true}
                            />
                        )}
                    </div>

                    {/* Components Section */}
                    <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Box className="h-3 w-3" />
                            Components Attachment
                        </h4>

                        {isLoadingComponents ? (
                            <div className="flex items-center gap-2 text-slate-500 p-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-xs">Loading components...</span>
                            </div>
                        ) : components.length === 0 ? (
                            <div className="text-sm text-slate-500 italic px-2">No components found</div>
                        ) : (
                            <div className="pl-2 border-l-2 border-slate-100 dark:border-slate-800 ml-1">
                                {components.map((comp: Component) => {
                                    const compAttachList = allAttachments.filter((a: any) => 
                                        (a.source_type?.toLowerCase() === 'component' || a.source_type?.toLowerCase() === 'structure_component') && a.source_id === comp.id
                                        || a.component_id === comp.id
                                    );
                                    const hasAttachments = compAttachList.length > 0;
                                    if (!hasAttachments) return null;

                                    return (
                                        <ComponentNode
                                            key={comp.id}
                                            component={comp}
                                            allAttachments={allAttachments}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
};

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin } from "lucide-react";

export default function AttachmentTreeView() {
    // Access global store
    const { filters, selectedPlatformId, setSelectedPlatformId } = useAttachmentStore();
    const { searchQuery, hasAttachmentsOnly } = filters;



    // Fetch all platforms
    const { data: platformsData, isLoading: isLoadingPlatforms } = useSWR('/api/platform', fetcher);

    // Fetch all attachments
    const { data: attachmentsData, isLoading: isLoadingAttachments } = useSWR('/api/attachment', fetcher);

    // Fetch active components unconditionally but with a null key if there's no selected platform
    const { data: activeComponentsData, isLoading: isLoadingActiveComponents } = useSWR(
        selectedPlatformId ? `/api/structure-components/${selectedPlatformId}` : null,
        fetcher
    );

    if (isLoadingPlatforms || isLoadingAttachments) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Tree View...</p>
            </div>
        );
    }

    const allPlatforms = (platformsData?.data || []) as Platform[];
    const allAttachments = (attachmentsData?.data || []) as Attachment[];

    // Filter Logic
    const filteredPlatforms = allPlatforms.filter(platform => {
        // Search Filter
        const matchesSearch = platform.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (platform.pfield && platform.pfield.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchesSearch) return false;

        // Attachment Filter
        if (hasAttachmentsOnly) {
            const hasAnyAttachments = allAttachments.some((a: any) => 
                (a.source_type === 'platform' && a.source_id === platform.plat_id) || 
                (a.structure_id === platform.plat_id && a.structure_type === 'Platform')
            );
            return hasAnyAttachments;
        }

        return true;
    });

    // Group filtered platforms by field
    const groupedPlatforms = filteredPlatforms.reduce((acc, platform) => {
        const fieldName = platform.pfield || "Unassigned Field";
        if (!acc[fieldName]) {
            acc[fieldName] = [];
        }
        acc[fieldName].push(platform);
        return acc;
    }, {} as Record<string, Platform[]>);

    const activePlatform = allPlatforms.find(p => p.plat_id === selectedPlatformId);

    return (
        <div className="flex h-full gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Left Sidebar Pane */}
            <div className="w-80 flex-shrink-0 flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 shadow-sm overflow-hidden h-[calc(100vh-12rem)]">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Field Overview</h3>
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
                                <Collapsible key={field} className="mb-4">
                                    <CollapsibleTrigger asChild>
                                        <Button variant="ghost" className="w-full flex items-center justify-start p-2 h-auto hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg group">
                                            <ChevronDown className="h-4 w-4 shrink-0 mr-2 text-slate-400 transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
                                            <MapPin className="h-4 w-4 mr-2 text-blue-500" />
                                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200 uppercase tracking-wide">{field}</span>
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="pl-4 mt-1 border-l ml-3 border-slate-200 dark:border-slate-800 space-y-1">
                                        {platforms.map(platform => {
                                            const totalPlatformAttachments = allAttachments.filter((a: any) => 
                                                (a.source_type === 'platform' && a.source_id === platform.plat_id) || 
                                                (a.structure_id === platform.plat_id && a.structure_type === 'Platform')
                                            );
                                            const isSelected = selectedPlatformId === platform.plat_id;

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
                                                        <span className="truncate text-sm">{platform.title}</span>
                                                        <span className="text-[10px] uppercase tracking-wider opacity-70 truncate">{platform.ptype || "Platform"}</span>
                                                    </div>
                                                    {totalPlatformAttachments.length > 0 && (
                                                        <div className="flex items-center gap-1 shrink-0 ml-2 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded shadow-sm border border-slate-200 dark:border-slate-700">
                                                            <Paperclip className="h-3 w-3 text-blue-500" />
                                                            <span className="text-[10px] font-bold">{totalPlatformAttachments.length}</span>
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
            <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 xl shadow-sm overflow-hidden h-[calc(100vh-12rem)] flex flex-col">
                {!activePlatform ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                        <Box className="h-16 w-16 mb-4 opacity-20" />
                        <h3 className="text-xl font-medium text-slate-600 dark:text-slate-300 mb-2">No Asset Selected</h3>
                        <p className="text-sm text-center max-w-sm">Select a platform from the assets explorer on the left to view its attachments.</p>
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
                            </div>
                        </div>

                        {/* Tabs content */}
                        <div className="flex-1 overflow-hidden p-6 pb-0">
                            <Tabs defaultValue="platform" className="h-full flex flex-col">
                                <TabsList className="grid w-full grid-cols-3 mb-6 shrink-0 bg-slate-100/80 dark:bg-slate-900 h-12 p-1 border border-slate-200/50 dark:border-slate-800">
                                    <TabsTrigger
                                        value="platform"
                                        className="h-full data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-blue-600 data-[state=active]:shadow-sm rounded-md transition-all font-semibold"
                                    >
                                        <Paperclip className="h-4 w-4 mr-2" />
                                        Platform Attachments
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="components"
                                        className="h-full data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-md transition-all font-semibold"
                                    >
                                        <Box className="h-4 w-4 mr-2" />
                                        Component Attachments
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="inspection"
                                        className="h-full data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm rounded-md transition-all font-semibold"
                                    >
                                        <ClipboardList className="h-4 w-4 mr-2" />
                                        Inspection Attachments
                                    </TabsTrigger>
                                </TabsList>

                                {/* Platform Attachments Tab */}
                                <TabsContent value="platform" className="flex-1 overflow-hidden mt-0 border-none outline-none data-[state=inactive]:hidden flex flex-col">
                                    <ScrollArea className="flex-1 h-full pr-4 pb-4">
                                        {(() => {
                                            const platformAttachments = getAttachmentsForSource(allAttachments, 'platform', activePlatform.plat_id);
                                            if (platformAttachments.length === 0) {
                                                return (
                                                    <div className="flex flex-col items-center justify-center p-12 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl mt-4">
                                                        <Paperclip className="h-10 w-10 mb-2 opacity-20" />
                                                        <p className="font-bold text-sm">No attachment found</p>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div className="pb-8">
                                                    <DataTable
                                                        columns={attachmentColumns}
                                                        data={platformAttachments}
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
                                        {isLoadingActiveComponents ? (
                                            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                                                <Loader2 className="h-8 w-8 animate-spin mb-4 text-indigo-500" />
                                                <p className="text-sm font-medium">Loading components...</p>
                                            </div>
                                        ) : (() => {
                                            const components = (activeComponentsData?.data || []) as Component[];
                                            if (components.length === 0) {
                                                return (
                                                    <div className="flex flex-col items-center justify-center p-12 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl mt-4">
                                                        <Box className="h-10 w-10 mb-2 opacity-20" />
                                                        <p className="font-bold text-sm">No components found for this platform</p>
                                                    </div>
                                                );
                                            }

                                            const activeCompIds = components.map(c => c.id);
                                            let allCompAttachments = allAttachments.filter((a: any) => 
                                                (a.source_type?.toLowerCase() === 'component' || a.source_type?.toLowerCase() === 'structure_component') && 
                                                (activeCompIds.includes(a.source_id) || activeCompIds.includes(a.component_id))
                                            );



                                            if (allCompAttachments.length === 0) {
                                                return (
                                                    <div className="flex flex-col items-center justify-center p-12 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl mt-4">
                                                        <Paperclip className="h-10 w-10 mb-2 opacity-20" />
                                                        <p className="font-bold text-sm">No attachment found</p>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="pb-8">
                                                    <div className="border border-slate-200/60 dark:border-slate-800/60 rounded-2xl overflow-hidden shadow-sm">
                                                        <DataTable
                                                            columns={globalAttachments}
                                                            data={allCompAttachments}
                                                            disableRowClick={true}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </ScrollArea>
                                </TabsContent>

                                {/* Inspection Attachments Tab */}
                                <InspectionAttachmentsTab platformId={activePlatform.plat_id} />

                            </Tabs>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Inspection Attachments Tab ───────────────────────────────────────────────

function InspectionAttachmentsTab({ platformId }: { platformId: number }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [previewId, setPreviewId] = useState<number | null>(null);

    const { data, isLoading } = useSWR(
        platformId ? `/api/attachment/inspection?platform_id=${platformId}` : null,
        fetcher
    );

    const allItems: any[] = data?.data || [];

    const filtered = searchQuery.trim()
        ? allItems.filter((item) => {
            const q = searchQuery.toLowerCase();
            return (
                (item.component_q_id || "").toLowerCase().includes(q) ||
                (item.inspection_type_name || "").toLowerCase().includes(q) ||
                (item.inspection_type_code || "").toLowerCase().includes(q) ||
                (item.jobpack_name || "").toLowerCase().includes(q) ||
                (item.name || "").toLowerCase().includes(q) ||
                (item.sow_report_no || "").toLowerCase().includes(q)
            );
        })
        : allItems;

    return (
        <TabsContent value="inspection" className="flex-1 overflow-hidden mt-0 border-none outline-none data-[state=inactive]:hidden flex flex-col">
            {/* Search bar */}
            <div className="mb-4 shrink-0">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search by component, inspection type, jobpack..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 h-9 text-sm"
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
                        <p className="text-xs mt-1 text-center max-w-xs">
                            Inspection attachments are added during field inspection recording.
                        </p>
                    </div>
                ) : (
                    <div className="pb-8 space-y-0 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                        {/* Table Header */}
                        <div className="grid grid-cols-[140px_120px_120px_150px_90px_60px_1fr_80px] gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <span>Component</span>
                            <span>Inspection Type</span>
                            <span>Date</span>
                            <span>Jobpack</span>
                            <span>SOW Report</span>
                            <span className="text-center">Status</span>
                            <span>File</span>
                            <span></span>
                        </div>

                        {/* Table Rows */}
                        {filtered.map((item: any, idx: number) => {
                            const { fileUrl, fileName } = processAttachmentUrl(item);
                            const displayText = truncateText(fileName, 35);
                            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
                            return (
                                <div key={item.id} className="flex flex-col border-b border-slate-100 dark:border-slate-800/80">
                                    <div
                                        className={cn(
                                            "grid grid-cols-[140px_120px_120px_150px_90px_60px_1fr_80px] gap-2 px-4 py-3 text-xs items-center hover:bg-slate-50/80 dark:hover:bg-slate-900/30 transition-colors",
                                            idx % 2 === 0 ? "" : "bg-slate-50/30 dark:bg-slate-900/10"
                                        )}
                                    >
                                        {/* Component */}
                                        <div className="flex flex-col min-w-0">
                                            {item.component_q_id ? (
                                                <>
                                                    <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{item.component_q_id}</span>
                                                    {item.component_description && (
                                                        <span className="text-[10px] text-slate-400 truncate">{item.component_description}</span>
                                                    )}
                                                </>
                                            ) : (
                                                <span className="text-slate-400 italic">No component</span>
                                            )}
                                        </div>

                                        {/* Inspection Type */}
                                        <div className="flex flex-col min-w-0">
                                            {item.inspection_type_name ? (
                                                <>
                                                    <span className="font-medium text-slate-700 dark:text-slate-200 truncate text-[11px]">{item.inspection_type_name}</span>
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{item.inspection_type_code}</span>
                                                </>
                                            ) : (
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded w-fit">
                                                    {item.inspection_type_code || "N/A"}
                                                </span>
                                            )}
                                        </div>

                                        {/* Date */}
                                        <div className="flex items-center gap-1.5 text-slate-500 min-w-0">
                                            <Calendar className="h-3 w-3 text-slate-300 shrink-0" />
                                            <span className="truncate">
                                                {item.inspection_date
                                                    ? format(new Date(item.inspection_date), "dd MMM yyyy")
                                                    : "—"}
                                            </span>
                                        </div>

                                        {/* Jobpack */}
                                        <div className="min-w-0">
                                            {item.jobpack_name ? (
                                                <span className="font-semibold text-slate-600 dark:text-slate-300 truncate block text-[11px]" title={item.jobpack_name}>
                                                    {item.jobpack_name}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-600 italic text-[10px]">—</span>
                                            )}
                                        </div>

                                        {/* SOW Report */}
                                        <div className="min-w-0">
                                            {item.sow_report_no ? (
                                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800 truncate block" title={item.sow_report_no}>
                                                    {item.sow_report_no}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-600 italic text-[10px]">—</span>
                                            )}
                                        </div>

                                        {/* Status / Anomaly */}
                                        <div className="flex justify-center">
                                            {item.has_anomaly ? (
                                                <div title="Anomaly Found" className="flex items-center justify-center h-6 w-6 rounded-full bg-red-100 dark:bg-red-900/30">
                                                    <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                                                </div>
                                            ) : item.inspection_status === "COMPLETED" ? (
                                                <div title="Completed" className="flex items-center justify-center h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/30">
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                                </div>
                                            ) : (
                                                <div title="In Progress / Draft" className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-900/30">
                                                    <FileClock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                                </div>
                                            )}
                                        </div>

                                        {/* File link */}
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <Paperclip className="h-3 w-3 text-slate-300 shrink-0" />
                                                {fileUrl ? (
                                                    <a
                                                        href={fileUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1 max-w-full text-xs font-medium transition-colors truncate"
                                                        title={fileUrl}
                                                    >
                                                        <span className="truncate">{displayText}</span>
                                                        <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-70" />
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-400 italic text-[10px]">No file</span>
                                                )}
                                            </div>
                                            {item.name && item.name !== fileName && (
                                                <span className="text-[10px] text-slate-400 pl-5 truncate">{item.name}</span>
                                            )}
                                        </div>

                                        {/* File type badge / Preview button */}
                                        <div className="flex justify-end">
                                            {isImage && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className={cn(
                                                        "h-7 px-2 text-[10px] font-black uppercase transition-all",
                                                        previewId === item.id 
                                                            ? "bg-violet-600 text-white hover:bg-violet-700 border-violet-600" 
                                                            : "bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border-violet-100 dark:border-violet-800 hover:bg-violet-100"
                                                    )}
                                                    onClick={() => setPreviewId(previewId === item.id ? null : item.id)}
                                                >
                                                    {previewId === item.id ? "Close" : "Preview"}
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Preview Area */}
                                    {previewId === item.id && fileUrl && (
                                        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800/50 animate-in slide-in-from-top-2 duration-300">
                                            <div className="relative group max-w-2xl mx-auto rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg bg-white dark:bg-slate-950">
                                                <img 
                                                    src={fileUrl} 
                                                    alt={fileName} 
                                                    className="w-full h-auto object-contain max-h-[500px]"
                                                />
                                                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button 
                                                        variant="secondary" 
                                                        size="icon" 
                                                        className="h-8 w-8 bg-white/90 dark:bg-slate-900/90"
                                                        onClick={() => window.open(fileUrl, '_blank')}
                                                    >
                                                        <ExternalLink className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        variant="destructive" 
                                                        size="icon" 
                                                        className="h-8 w-8"
                                                        onClick={() => setPreviewId(null)}
                                                    >
                                                        <span className="text-lg">×</span>
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Footer summary */}
                        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
                            <span className="text-[10px] text-slate-400 font-medium">
                                {filtered.length} inspection attachment{filtered.length !== 1 ? "s" : ""} found
                            </span>
                            <div className="flex items-center gap-3 text-[9px] text-slate-400">
                                <span className="flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5 text-red-400" /> Anomaly</span>
                                <span className="flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5 text-green-400" /> Completed</span>
                                <span className="flex items-center gap-1"><FileClock className="h-2.5 w-2.5 text-amber-400" /> In Progress</span>
                            </div>
                        </div>
                    </div>
                )}
            </ScrollArea>
        </TabsContent>
    );
}
