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
    Database
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

    // Fetch Master List
    const { data: masterData, error: masterError, isLoading: masterLoading } = useSWR(
        "/api/library/master",
        fetcher
    );

    const masters: LibMaster[] = masterData?.data || [];

    const filteredMasters = masters.filter(m =>
        m.lib_desc?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.lib_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.lib_name?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (a.lib_name || a.lib_desc || "").localeCompare(b.lib_name || b.lib_desc || ""));

    return (
        <div className="flex h-[calc(100vh-6rem)] gap-0 overflow-hidden rounded-lg border bg-background shadow-sm">
            {/* Master List Sidebar */}
            <div className="w-1/3 min-w-[300px] border-r flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
                <div className="p-4 border-b space-y-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                            <Database className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-lg">Library Master</h2>
                            <p className="text-xs text-muted-foreground">Select a category to view items</p>
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search categories..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-white dark:bg-slate-950"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {masterLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : masterError ? (
                        <div className="p-4 text-red-500 text-sm text-center">
                            Error loading library: {masterError.message || "Unknown error"}
                        </div>
                    ) : filteredMasters.length > 0 ? (
                        filteredMasters.map((master) => (
                            <button
                                key={master.lib_code}
                                onClick={() => setSelectedMaster(master)}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-all border border-transparent
                  ${selectedMaster?.lib_code === master.lib_code
                                        ? "bg-white dark:bg-slate-950 shadow-sm border-slate-200 dark:border-slate-800 font-medium text-blue-600 dark:text-blue-400"
                                        : "hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400"}
                `}
                            >
                                <div className="flex justify-between items-center">
                                    <span>{master.lib_name || master.lib_desc}</span>
                                    {/* <Badge variant="outline" className="text-[10px] h-5 px-1.5">{master.lib_code}</Badge> */}
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className="text-center p-8 text-muted-foreground text-sm">
                            No categories found
                        </div>
                    )}
                </div>
            </div>

            {/* Detail List View */}
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-950">
                {selectedMaster ? (
                    <LibraryDetails key={selectedMaster.lib_code} master={selectedMaster} />
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
                            <Database className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No Category Selected</h3>
                        <p className="max-w-xs text-center mt-2">Select a library category from the list to view and manage its items.</p>
                    </div>
                )}
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
            <div className="px-6 py-4 border-b flex justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                        {master.lib_name || master.lib_desc}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-60">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search items..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add Item
                    </Button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : filteredItems.length > 0 ? (
                    <div className="grid gap-3">
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
                    <div className="text-center py-20 border-2 border-dashed rounded-xl">
                        <p className="text-muted-foreground">No items found in this category.</p>
                        <Button variant="link" onClick={() => setIsCreateOpen(true)}>Create the first one</Button>
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
            // If already deleted, maybe we want to undelete? 
            // User requirement: "option to undelete or delete"
            // So if deleted, we undelete (lib_delete = 0 or null). If not, we delete (lib_delete = 1).
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
        <div className={`
            relative group flex items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer
            ${isDeleted
                ? "bg-red-50 dark:bg-red-950/10 border-red-200 dark:border-red-900/30 hover:border-red-300"
                : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-blue-400 hover:shadow-md hover:bg-blue-50/30 dark:hover:bg-blue-950/20"}
            ${isEditOpen ? "border-blue-500 shadow-lg ring-2 ring-blue-200 dark:ring-blue-900/50" : ""}
        `}>
            {/* Left border indicator */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg transition-all ${isEditOpen
                ? "bg-blue-500"
                : "bg-transparent group-hover:bg-blue-400"
                }`} />
            <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                <div className="col-span-3 flex items-center gap-2">
                    <div className="flex flex-col flex-1">
                        <span className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">ID (Code)</span>
                        <span className={`font-mono text-sm font-semibold ${isDeleted ? "text-red-700 dark:text-red-400 line-through" : "text-blue-700 dark:text-blue-400"}`}>
                            {item.lib_id || item.lib_val || item.code || "—"}
                        </span>
                    </div>
                    {master.lib_code === "COLOR" && (item.lib_id || item.lib_val) && (
                        <div
                            className="w-10 h-10 rounded border-2 border-slate-300 dark:border-slate-600 shadow-sm flex-shrink-0"
                            style={{
                                backgroundColor: `rgb(${item.lib_id || item.lib_val})`,
                            }}
                            title={`RGB: ${item.lib_id || item.lib_val}`}
                        />
                    )}
                    {master.lib_code === "CONTR_NAM" && item.logo_url && (
                        <img
                            src={item.logo_url}
                            alt={item.lib_desc || "Contractor logo"}
                            className="w-10 h-10 rounded border-2 border-slate-300 dark:border-slate-600 object-contain bg-white flex-shrink-0"
                        />
                    )}
                </div>
                <div className="col-span-4 flex flex-col">
                    <span className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">Description</span>
                    <span className={`text-sm ${isDeleted ? "text-red-600 dark:text-red-500" : "text-slate-700 dark:text-slate-300"}`}>
                        {item.lib_desc || "—"}
                    </span>
                </div>
                <div className="col-span-5 flex flex-col">
                    <span className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">Comments</span>
                    <span className={`text-sm ${isDeleted ? "text-red-400" : "text-slate-500 dark:text-slate-400"} truncate`}>
                        {item.lib_com || "—"}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2 opacity-100 transition-opacity">
                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => setIsEditOpen(true)} disabled={isLoading}>
                    <Edit className="w-4 h-4" />
                </Button>

                <Button
                    size="icon"
                    variant="ghost"
                    className={`h-8 w-8 ${isDeleted ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-slate-400 hover:text-red-600 hover:bg-red-50"}`}
                    onClick={handleSoftDelete}
                    disabled={isLoading}
                    title={isDeleted ? "Restore" : "Delete"}
                >
                    {isDeleted ? <RefreshCcw className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
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

    console.log("Create Dialog - lib_code:", master.lib_code, "isContractor:", isContractorLibrary);

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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Item - {master.lib_name || master.lib_desc}</DialogTitle>
                    <DialogDescription>Create a new entry for the <strong>{master.lib_name || master.lib_desc}</strong> category.</DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4">
                    {isColorLibrary ? (
                        <ColorPicker
                            onColorChange={(rgb, name) => {
                                setColorRgb(rgb);
                                setColorName(name);
                            }}
                        />
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="lib_val">Value/Code</Label>
                                <Input id="lib_val" name="lib_val" required placeholder="e.g. DRILL" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lib_desc">Description</Label>
                                <Input id="lib_desc" name="lib_desc" required placeholder="e.g. Drilling Platform" />
                            </div>
                        </>
                    )}
                    {isContractorLibrary && (
                        <ImageUpload
                            onImageChange={setLogoUrl}
                            storagePath={`CONTRACTOR/${new Date().getTime()}`}
                        />
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="lib_com">Comments (Optional)</Label>
                        <Textarea id="lib_com" name="lib_com" placeholder="Additional notes..." className="min-h-[100px]" />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={loading || (isColorLibrary && (!colorRgb || !colorName))}>
                            {loading ? "Creating..." : "Create"}
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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Item - {master.lib_name || master.lib_desc}</DialogTitle>
                    <DialogDescription>
                        Editing item in <strong>{master.lib_name || master.lib_desc}</strong> category. Note: The Value/Code cannot be changed as it may be referenced in other tables.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4">
                    {isColorLibrary ? (
                        <>
                            <div className="space-y-2">
                                <Label>RGB Value (Read-only)</Label>
                                <div className="flex gap-3 items-center">
                                    <div
                                        className="w-16 h-16 rounded border-2 border-slate-300 dark:border-slate-600 shadow-md flex-shrink-0"
                                        style={{
                                            backgroundColor: `rgb(${item.lib_id || item.lib_val || "0,0,0"})`,
                                        }}
                                        title={`RGB: ${item.lib_id || item.lib_val}`}
                                    />
                                    <Input
                                        value={item.lib_id || item.lib_val || ""}
                                        disabled
                                        className="bg-slate-100 dark:bg-slate-900 cursor-not-allowed opacity-70 font-mono flex-1"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">The RGB value cannot be changed. Create a new color instead.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="color_name">Color Name</Label>
                                <Input
                                    id="color_name"
                                    value={colorName}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColorName(e.target.value)}
                                    placeholder="e.g., Red"
                                    required
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="lib_val">Value/Code (Read-only)</Label>
                                <Input
                                    id="lib_val"
                                    name="lib_val"
                                    defaultValue={item.lib_id?.toString() || item.lib_val || item.code}
                                    disabled
                                    className="bg-slate-100 dark:bg-slate-900 cursor-not-allowed opacity-70"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lib_desc">Description</Label>
                                <Input id="lib_desc" name="lib_desc" defaultValue={item.lib_desc} required />
                            </div>
                            {isContractorLibrary && (
                                <ImageUpload
                                    currentImageUrl={item.logo_url}
                                    onImageChange={setLogoUrl}
                                    storagePath={`CONTRACTOR/${item.lib_id || item.lib_val || 'temp'}`}
                                />
                            )}
                        </>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="lib_com">Comments</Label>
                        <Textarea id="lib_com" name="lib_com" defaultValue={item.lib_com} className="min-h-[100px]" />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Changes"}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
