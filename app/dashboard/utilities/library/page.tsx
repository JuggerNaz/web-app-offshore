"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr"; // mutate for revalidation
import { fetcher } from "@/utils/utils";
import { LibraryComboDetails } from "./combo-library";
import { ColorPicker } from "./color-picker";
import { ImageUpload } from "./image-upload";
import {
    Building2,
    Search,
    Plus,
    Trash2,
    RefreshCcw,
    Edit,
    MoreVertical,
    Loader2,
    Database,
    Layers2,
    Package,
    ArrowRight
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Types
interface LibMaster {
    lib_code: string;
    lib_name: string; // Updated from lib_desc preference
    lib_desc: string;
    hidden_item?: string;
}

interface LibItem {
    id: number;
    lib_code: string;
    lib_val?: string;
    lib_id?: number | string;
    code?: string;
    lib_desc?: string;
    lib_com?: string;
    hidden_item?: string;
    lib_delete?: number;
    logo_url?: string; // For contractor logos
    [key: string]: any;
}

export default function LibraryPage() {
    const [selectedMaster, setSelectedMaster] = useState<LibMaster | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [detailSearchTerm, setDetailSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<"all" | "combination" | "standard">("all");

    // Fetch Master List
    const { data: masterData, error: masterError, isLoading: masterLoading } = useSWR(
        "/api/library/master",
        fetcher
    );

    // Hardcoded list of combination categories
    const COMBINATION_CATEGORIES = ['AMLYCODFND', 'ANMLYCLR', 'ANMALTDAYS', 'ANMTRGINSP'];

    const masters: LibMaster[] = masterData?.data || [];

    const filteredMasters = masters.filter(m => {
        // Filter by category type
        const isCombination = COMBINATION_CATEGORIES.includes(m.lib_code);

        if (categoryFilter === "combination" && !isCombination) return false;
        if (categoryFilter === "standard" && isCombination) return false;

        // Search filter
        return m.lib_desc?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.lib_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            m.lib_name?.toLowerCase().includes(searchTerm.toLowerCase());
    }).sort((a, b) => (a.lib_name || a.lib_desc || "").localeCompare(b.lib_name || b.lib_desc || ""));

    return (
        <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/30 dark:bg-slate-950/20 animate-in fade-in duration-700">
            <div className="max-w-[1600px] mx-auto w-full p-6 md:p-8 space-y-6 md:space-y-8 flex flex-col h-full min-h-[calc(100vh-4rem)]">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
                    <div className="flex items-center gap-5">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Database className="h-7 w-7" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                                <span className="opacity-70">System</span>
                                <div className="h-1 w-1 rounded-full bg-blue-500" />
                                <span className="text-slate-900 dark:text-white/90">Configuration</span>
                            </div>
                            <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
                                Library Master Data
                            </h1>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
                    {/* Sidebar Panel */}
                    <div className="col-span-12 lg:col-span-3 flex flex-col bg-white dark:bg-slate-950 rounded-[2rem] border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-black/20 overflow-hidden h-full">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-4 bg-slate-50/30 dark:bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-100/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
                                    <Layers2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wide">Categories</h2>
                                    <p className="text-[10px] text-slate-400 font-medium">SELECT TO MANAGE</p>
                                </div>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="Filter categories..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 h-10 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl focus-visible:ring-blue-500/20"
                                />
                            </div>
                            {/* Category Type Filter */}
                            <div className="flex gap-1 p-1 bg-slate-100/80 dark:bg-slate-900/50 rounded-lg">
                                {['all', 'combination', 'standard'].map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setCategoryFilter(t as any)}
                                        className={cn(
                                            "flex-1 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all",
                                            categoryFilter === t
                                                ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm"
                                                : "text-slate-400 hover:text-slate-600 cursor-pointer"
                                        )}
                                    >
                                        {t.toString().substring(0, 4)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                            {masterLoading ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : masterError ? (
                                <div className="p-4 text-red-500 text-xs text-center border border-red-100 rounded-xl bg-red-50">
                                    Error loading library
                                </div>
                            ) : filteredMasters.length > 0 ? (
                                filteredMasters.map((master) => (
                                    <button
                                        key={master.lib_code}
                                        onClick={() => setSelectedMaster(master)}
                                        className={cn(
                                            "w-full text-left px-4 py-3 rounded-xl transition-all border group relative",
                                            selectedMaster?.lib_code === master.lib_code
                                                ? "bg-blue-50/50 dark:bg-blue-900/20 border-blue-200/60 dark:border-blue-800 text-blue-700 dark:text-blue-300 shadow-sm"
                                                : "bg-transparent border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                                        )}
                                    >
                                        <div className="flex justify-between items-center relative z-10">
                                            <span className="font-medium text-sm truncate pr-2">{master.lib_name || master.lib_desc}</span>
                                            {selectedMaster?.lib_code === master.lib_code && (
                                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                                            )}
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="text-center p-8 text-muted-foreground text-xs italic">
                                    No categories found
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Panel */}
                    <div className="col-span-12 lg:col-span-9 flex flex-col bg-white dark:bg-slate-950 rounded-[2rem] border border-slate-200/60 dark:border-slate-800 shadow-xl shadow-slate-200/20 dark:shadow-black/20 overflow-hidden h-full">
                        {selectedMaster ? (
                            <LibraryDetails key={selectedMaster.lib_code} master={selectedMaster} />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 bg-slate-50/30 dark:bg-white/[0.02]">
                                <div className="w-20 h-20 bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center mb-6">
                                    <Layers2 className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Select a Category</h3>
                                <p className="max-w-xs text-center mt-2 text-sm text-slate-500">Choose a library category from the sidebar to view and manage its items.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function LibraryDetails({ master }: { master: LibMaster }) {
    // Check if this is a combo library
    const COMBO_LIBRARIES = ['AMLYCODFND', 'ANMLYCLR', 'ANMTRGINSP', 'ANMALTDAYS'];
    const isComboLibrary = COMBO_LIBRARIES.includes(master.lib_code);

    // Route to combo interface if needed
    if (isComboLibrary) {
        return <LibraryComboDetails master={master} />;
    }

    const [searchTerm, setSearchTerm] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Fetch Items
    const { data: itemsData, error, isLoading, mutate: refreshItems } = useSWR(
        master ? `/api/library/${encodeURIComponent(master.lib_code)}` : null,
        fetcher
    );

    const items: LibItem[] = itemsData?.data || [];

    const filteredItems = items.filter(item => {
        // Search in all string values
        const searchStr = searchTerm.toLowerCase();
        return Object.values(item).some(val =>
            typeof val === 'string' && val.toLowerCase().includes(searchStr)
        );
    });

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 sticky top-0 z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 uppercase tracking-wider">
                                {master.lib_code}
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                            {master.lib_name || master.lib_desc}
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search items..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-10 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-blue-500/20"
                            />
                        </div>
                        <Button onClick={() => setIsCreateOpen(true)} className="gap-2 rounded-xl h-10 px-4 font-semibold shadow-lg shadow-blue-500/20">
                            <Plus className="w-4 h-4" />
                            Add Item
                        </Button>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-0 bg-slate-50/30 dark:bg-black/20">
                {isLoading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : filteredItems.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredItems.map(item => (
                            <LibraryItemRow
                                key={`${master.lib_code}-${item.id || item.lib_id || item.lib_val || Math.random()}`}
                                item={item}
                                master={master}
                                onRefresh={refreshItems}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4 text-slate-300">
                            <Package className="w-8 h-8" />
                        </div>
                        <p className="text-muted-foreground font-medium">No items found.</p>
                        <Button variant="link" onClick={() => setIsCreateOpen(true)} className="text-blue-600">Create the first one</Button>
                    </div>
                )}
            </div>

            <CreateItemDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                master={master}
                onSuccess={refreshItems}
            />
        </div>
    );
}

function LibraryItemRow({ item, master, onRefresh }: { item: LibItem, master: LibMaster, onRefresh: () => void }) {
    const isDeleted = item.lib_delete === 1;
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSoftDelete = async () => {
        if (!confirm("Are you sure you want to delete this item?")) return;
        setIsLoading(true);
        try {
            const newStatus = isDeleted ? 0 : 1;
            const res = await fetch(`/api/library/${encodeURIComponent(master.lib_code)}/${encodeURIComponent(String(item.lib_id || item.lib_val))}`, {
                method: "PUT",
                body: JSON.stringify({ lib_delete: newStatus }),
            });

            if (res.ok) {
                toast.success(isDeleted ? "Item restored" : "Item deleted");
                onRefresh();
            } else {
                toast.error("Failed to update status");
            }
        } catch (e) {
            toast.error("Error updating status");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={cn(
            "group flex items-center justify-between p-4 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors",
            isDeleted && "bg-slate-50 opacity-60 grayscale"
        )}>
            <div className="flex-1 grid grid-cols-12 gap-6 items-center">
                <div className="col-span-3 flex items-center gap-3">
                    {/* Visual Indicator / Icon */}
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-xs shrink-0">
                        {master.lib_code.substring(0, 2)}
                    </div>

                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] uppercase text-slate-400 font-bold mb-0.5 tracking-wider">ID / Code</span>
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "font-mono text-sm font-bold truncate",
                                isDeleted ? "text-slate-500 line-through" : "text-blue-700 dark:text-blue-400"
                            )}>
                                {item.lib_id || item.lib_val || item.code || "—"}
                            </span>
                            {master.lib_code === "COLOR" && (item.lib_id || item.lib_val) && (
                                <div
                                    className="w-4 h-4 rounded-full border border-slate-200 shadow-sm"
                                    style={{ backgroundColor: `rgb(${item.lib_id || item.lib_val})` }}
                                    title={`RGB: ${item.lib_id || item.lib_val}`}
                                />
                            )}
                            {master.lib_code === "CONTR_NAM" && item.logo_url && (
                                <img
                                    src={item.logo_url}
                                    alt="Logo"
                                    className="w-5 h-5 object-contain"
                                />
                            )}
                        </div>
                    </div>
                </div>
                <div className="col-span-4 flex flex-col min-w-0">
                    <span className="text-[10px] uppercase text-slate-400 font-bold mb-0.5 tracking-wider">Description</span>
                    <span className={cn(
                        "text-sm font-medium truncate",
                        isDeleted ? "text-slate-500" : "text-slate-700 dark:text-slate-200"
                    )}>
                        {item.lib_desc || "—"}
                    </span>
                </div>
                <div className="col-span-4 flex flex-col min-w-0">
                    <span className="text-[10px] uppercase text-slate-400 font-bold mb-0.5 tracking-wider">Comments</span>
                    <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {item.lib_com || "—"}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" onClick={() => setIsEditOpen(true)} disabled={isLoading}>
                    <Edit className="w-3.5 h-3.5" />
                </Button>

                <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                        "h-8 w-8 rounded-lg",
                        isDeleted
                            ? "text-green-600 hover:text-green-700 hover:bg-green-50"
                            : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                    )}
                    onClick={handleSoftDelete}
                    disabled={isLoading}
                    title={isDeleted ? "Restore" : "Delete"}
                >
                    {isDeleted ? <RefreshCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
            </div>

            <EditItemDialog
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                item={item}
                master={master}
                onSuccess={onRefresh}
            />
        </div>
    );
}

// Dialogs for Create/Edit
function CreateItemDialog({ open, onOpenChange, master, onSuccess }: { open: boolean, onOpenChange: (open: boolean) => void, master: LibMaster, onSuccess: () => void }) {
    const [loading, setLoading] = useState(false);
    const [colorRgb, setColorRgb] = useState("");
    const [colorName, setColorName] = useState("");
    const [logoUrl, setLogoUrl] = useState<string | null>(null);

    const isColorLibrary = master.lib_code === "COLOR";
    const isContractorLibrary = master.lib_code === "CONTR_NAM";

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);

        const payload = {
            lib_id: isColorLibrary ? colorRgb : formData.get("lib_val"),
            lib_desc: isColorLibrary ? colorName : formData.get("lib_desc"),
            lib_com: formData.get("lib_com"),
            logo_url: isContractorLibrary ? logoUrl : undefined,
        };

        try {
            const res = await fetch(`/api/library/${encodeURIComponent(master.lib_code)}`, {
                method: "POST",
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                toast.success("Item created successfully");
                onOpenChange(false);
                onSuccess();
                // Reset color state
                setColorRgb("");
                setColorName("");
                setLogoUrl(null);
            } else {
                toast.error("Failed to create item");
            }
        } catch (error) {
            toast.error("Error creating item");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg rounded-[2rem]">
                <DialogHeader className="px-2">
                    <DialogTitle className="text-xl font-black uppercase text-slate-900">Add New Item</DialogTitle>
                    <DialogDescription>
                        Adding to <strong>{master.lib_name || master.lib_desc}</strong>
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-5 px-2">
                    {isColorLibrary ? (
                        <ColorPicker
                            onColorChange={(rgb, name) => {
                                setColorRgb(rgb);
                                setColorName(name);
                            }}
                        />
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2 md:col-span-1">
                                <Label htmlFor="lib_val" className="text-xs font-bold uppercase text-slate-500">Value/Code</Label>
                                <Input id="lib_val" name="lib_val" required placeholder="e.g. DRILL" className="rounded-xl font-mono" />
                            </div>
                            <div className="space-y-2 col-span-2 md:col-span-1">
                                <Label htmlFor="lib_desc" className="text-xs font-bold uppercase text-slate-500">Description</Label>
                                <Input id="lib_desc" name="lib_desc" required placeholder="e.g. Drilling Platform" className="rounded-xl" />
                            </div>
                        </div>
                    )}
                    {isContractorLibrary && (
                        <ImageUpload
                            onImageChange={setLogoUrl}
                            storagePath={`CONTRACTOR/${new Date().getTime()}`}
                        />
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="lib_com" className="text-xs font-bold uppercase text-slate-500">Comments</Label>
                        <Textarea id="lib_com" name="lib_com" placeholder="Additional notes..." className="min-h-[100px] rounded-xl resize-none" />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
                        <Button type="submit" disabled={loading || (isColorLibrary && (!colorRgb || !colorName))} className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700">
                            {loading ? "Creating..." : "Create Item"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function EditItemDialog({ open, onOpenChange, item, master, onSuccess }: { open: boolean, onOpenChange: (open: boolean) => void, item: LibItem, master: LibMaster, onSuccess: () => void }) {
    const [loading, setLoading] = useState(false);
    const [colorName, setColorName] = useState(item.lib_desc || "");
    const [logoUrl, setLogoUrl] = useState<string | null>(item.logo_url || null);

    const isColorLibrary = master.lib_code === "COLOR";
    const isContractorLibrary = master.lib_code === "CONTR_NAM";

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        // Only send description and comments - do NOT update lib_id/code
        const payload = {
            lib_desc: isColorLibrary ? colorName : formData.get("lib_desc"),
            lib_com: formData.get("lib_com"),
            logo_url: isContractorLibrary ? logoUrl : undefined,
        };

        try {
            const res = await fetch(`/api/library/${encodeURIComponent(master.lib_code)}/${encodeURIComponent(String(item.lib_id || item.lib_val))}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                toast.success("Item updated successfully");
                onOpenChange(false);
                onSuccess();
            } else {
                toast.error("Failed to update item");
            }
        } catch (error) {
            toast.error("Error updating item");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg rounded-[2rem]">
                <DialogHeader className="px-2">
                    <DialogTitle className="text-xl font-black uppercase text-slate-900">Edit Item</DialogTitle>
                    <DialogDescription>
                        Updating <strong>{item.lib_id || item.lib_val}</strong>
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-5 px-2">
                    {isColorLibrary ? (
                        <>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-slate-500">RGB Value</Label>
                                <div className="flex gap-3 items-center">
                                    <div
                                        className="w-12 h-12 rounded-xl border-2 border-slate-100 shadow-sm flex-shrink-0"
                                        style={{ backgroundColor: `rgb(${item.lib_id || item.lib_val || "0,0,0"})` }}
                                    />
                                    <Input
                                        value={item.lib_id || item.lib_val || ""}
                                        disabled
                                        className="bg-slate-50 font-mono rounded-xl border-0 ring-1 ring-slate-200"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="color_name" className="text-xs font-bold uppercase text-slate-500">Color Name</Label>
                                <Input
                                    id="color_name"
                                    value={colorName}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColorName(e.target.value)}
                                    placeholder="e.g., Red"
                                    required
                                    className="rounded-xl"
                                />
                            </div>
                        </>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2 md:col-span-1">
                                <Label htmlFor="lib_val" className="text-xs font-bold uppercase text-slate-500">Value/Code</Label>
                                <Input
                                    id="lib_val"
                                    name="lib_val"
                                    defaultValue={item.lib_id?.toString() || item.lib_val || item.code}
                                    disabled
                                    className="bg-slate-50 font-mono rounded-xl border-0 ring-1 ring-slate-200 text-slate-500"
                                />
                            </div>
                            <div className="space-y-2 col-span-2 md:col-span-1">
                                <Label htmlFor="lib_desc" className="text-xs font-bold uppercase text-slate-500">Description</Label>
                                <Input id="lib_desc" name="lib_desc" defaultValue={item.lib_desc} required className="rounded-xl" />
                            </div>
                            {isContractorLibrary && (
                                <div className="col-span-2">
                                    <ImageUpload
                                        currentImageUrl={item.logo_url}
                                        onImageChange={setLogoUrl}
                                        storagePath={`CONTRACTOR/${item.lib_id || item.lib_val || 'temp'}`}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="lib_com" className="text-xs font-bold uppercase text-slate-500">Comments</Label>
                        <Textarea id="lib_com" name="lib_com" defaultValue={item.lib_com} className="min-h-[100px] rounded-xl resize-none" />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
                        <Button type="submit" disabled={loading} className="rounded-xl font-bold bg-blue-600 hover:bg-blue-700">{loading ? "Saving..." : "Save Changes"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
