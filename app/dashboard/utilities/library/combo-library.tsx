"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import {
    Search,
    Plus,
    Trash2,
    RefreshCcw,
    RotateCcw,
    Archive,
    Edit,
    Loader2,
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
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Types
interface LibMaster {
    lib_code: string;
    lib_name: string;
    lib_desc: string;
}

interface ComboItem {
    lib_code: string;
    code_1: string;
    code_2: string;
    lib_com?: string;
    lib_delete?: number;
}

interface ComboOption {
    lib_id: string;
    lib_desc: string;
}

interface ComboOptions {
    code1_options: ComboOption[];
    code2_options: ComboOption[];
    code1_label: string;
    code2_label: string;
    code1_lib: string;
    code2_lib: string;
}

export function LibraryComboDetails({ master }: { master: LibMaster }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // Fetch combo items
    const { data: comboData, error, isLoading, mutate: refreshItems } = useSWR(
        `/api/library/combo/${encodeURIComponent(master.lib_code)}`,
        fetcher
    );

    // Fetch options for dropdowns
    const { data: optionsData } = useSWR(
        `/api/library/combo/${encodeURIComponent(master.lib_code)}/options`,
        fetcher
    );

    const comboItems: ComboItem[] = comboData?.data || [];
    const activeCount = comboItems.filter(i => i.lib_delete !== 1).length;
    const archivedCount = comboItems.filter(i => i.lib_delete === 1).length;

    const options: ComboOptions = optionsData?.data || {
        code1_options: [],
        code2_options: [],
        code1_label: 'Code 1',
        code2_label: 'Code 2',
        code1_lib: '',
        code2_lib: '',
    };

    // Create lookup maps for displaying descriptions
    const code1Map = new Map(
        options.code1_options.map((opt: ComboOption) => [opt.lib_id, opt.lib_desc])
    );
    const code2Map = new Map(
        options.code2_options.map((opt: ComboOption) => [opt.lib_id, opt.lib_desc])
    );

    const filteredItems = comboItems.filter(item => {
        const isDeleted = item.lib_delete === 1;
        if (statusFilter === "active" && isDeleted) return false;
        if (statusFilter === "archived" && !isDeleted) return false;

        const searchStr = searchTerm.toLowerCase();
        const code1Desc = code1Map.get(item.code_1) || item.code_1;
        const code2Desc = code2Map.get(item.code_2) || item.code_2;
        return (
            item.code_1.toLowerCase().includes(searchStr) ||
            item.code_2.toLowerCase().includes(searchStr) ||
            code1Desc.toLowerCase().includes(searchStr) ||
            code2Desc.toLowerCase().includes(searchStr) ||
            (item.lib_com && item.lib_com.toLowerCase().includes(searchStr))
        );
    });

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 py-4 border-b flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                        {master.lib_name || master.lib_desc}
                    </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {/* Status Filter Tabs */}
                    <div className="flex items-center gap-1 p-1 bg-slate-100/80 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        <button
                            onClick={() => setStatusFilter("all")}
                            className={cn(
                                "px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                                statusFilter === "all"
                                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                        >
                            All <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-700 rounded-full font-mono">{comboItems.length}</span>
                        </button>
                        <button
                            onClick={() => setStatusFilter("active")}
                            className={cn(
                                "px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                                statusFilter === "active"
                                    ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                        >
                            Active <span className="text-[10px] px-1.5 py-0.2 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-full font-mono">{activeCount}</span>
                        </button>
                        <button
                            onClick={() => setStatusFilter("archived")}
                            className={cn(
                                "px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
                                statusFilter === "archived"
                                    ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            )}
                        >
                            Archived <span className="text-[10px] px-1.5 py-0.2 bg-amber-50 dark:bg-amber-950 text-amber-600 rounded-full font-mono">{archivedCount}</span>
                        </button>
                    </div>

                    <div className="relative w-56">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search combinations..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Add Combination
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
                            <ComboItemRow
                                key={`${item.code_1}-${item.code_2}`}
                                item={item}
                                master={master}
                                code1Map={code1Map}
                                code2Map={code2Map}
                                code1Label={options.code1_label}
                                code2Label={options.code2_label}
                                code2Lib={options.code2_lib}
                                options={options}
                                onRefresh={refreshItems}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 border-2 border-dashed rounded-xl">
                        <p className="text-muted-foreground">No {statusFilter !== "all" ? statusFilter : ""} combinations found.</p>
                        <Button variant="link" onClick={() => setIsCreateOpen(true)}>Create the first one</Button>
                    </div>
                )}
            </div>

            <CreateComboDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                master={master}
                options={options}
                onSuccess={refreshItems}
            />
        </div>
    );
}

function ComboItemRow({
    item,
    master,
    code1Map,
    code2Map,
    code1Label,
    code2Label,
    code2Lib,
    options,
    onRefresh
}: {
    item: ComboItem;
    master: LibMaster;
    code1Map: Map<string, string>;
    code2Map: Map<string, string>;
    code1Label: string;
    code2Label: string;
    code2Lib: string;
    options: ComboOptions;
    onRefresh: () => void;
}) {
    const isDeleted = item.lib_delete === 1;
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSoftDelete = async () => {
        const actionText = isDeleted ? "restore" : "archive";
        if (!confirm(`Are you sure you want to ${actionText} this combination?`)) return;
        setIsLoading(true);
        try {
            const newStatus = isDeleted ? 0 : 1;
            const res = await fetch(`/api/library/combo/${encodeURIComponent(master.lib_code)}/${item.code_1}-${item.code_2}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lib_delete: newStatus }),
            });

            if (res.ok) {
                toast.success(isDeleted ? "Combination restored successfully!" : "Combination archived successfully!");
                onRefresh();
            } else {
                toast.error("Failed to update combination status");
            }
        } catch (e) {
            toast.error("Error updating combination status");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={cn(
            "relative group flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer",
            isDeleted
                ? "bg-amber-50/40 dark:bg-amber-950/10 border-amber-300 dark:border-amber-900/40 border-dashed"
                : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-blue-400 hover:shadow-md hover:bg-blue-50/30 dark:hover:bg-blue-950/20",
            isEditOpen && "border-blue-500 shadow-lg ring-2 ring-blue-200 dark:ring-blue-900/50"
        )}>
            {/* Left border indicator */}
            <div className={cn(
                "absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl transition-all",
                isDeleted
                    ? "bg-amber-500"
                    : isEditOpen ? "bg-blue-500" : "bg-transparent group-hover:bg-blue-400"
            )} />
            <div className="flex-1 grid grid-cols-12 gap-4 items-center pl-2">
                <div className="col-span-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] uppercase text-slate-400 font-bold">{code1Label}</span>
                        {isDeleted && (
                            <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-extrabold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 uppercase gap-1">
                                <Archive className="w-2.5 h-2.5" /> Archived
                            </Badge>
                        )}
                    </div>
                    <span className={cn(
                        "text-sm font-semibold",
                        isDeleted ? "text-slate-400 dark:text-slate-500 line-through" : "text-blue-700 dark:text-blue-400"
                    )}>
                        {item.code_1}
                    </span>
                    <span className={cn("text-xs", isDeleted ? "text-slate-400 italic" : "text-slate-500 dark:text-slate-400")}>
                        {code1Map.get(item.code_1) || "—"}
                    </span>
                </div>
                <div className="col-span-4 flex items-center gap-2">
                    <div className="flex flex-col flex-1">
                        <span className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">{code2Label}</span>
                        <span className={cn(
                            "text-sm font-semibold",
                            isDeleted ? "text-slate-400 dark:text-slate-500 line-through" : "text-blue-700 dark:text-blue-400"
                        )}>
                            {item.code_2}
                        </span>
                        <span className={cn("text-xs", isDeleted ? "text-slate-400 italic" : "text-slate-500 dark:text-slate-400")}>
                            {code2Map.get(item.code_2) || "—"}
                        </span>
                    </div>
                    {code2Lib === "COLOR" && item.code_2 && (
                        <div
                            className="w-10 h-10 rounded border-2 border-slate-300 dark:border-slate-600 shadow-sm flex-shrink-0"
                            style={{
                                backgroundColor: `rgb(${item.code_2})`,
                            }}
                            title={`RGB: ${code2Map.get(item.code_2)}`}
                        />
                    )}
                </div>
                <div className="col-span-4 flex flex-col">
                    <span className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">Comments</span>
                    <span className={cn(
                        "text-sm truncate",
                        isDeleted ? "text-slate-400 italic" : "text-slate-500 dark:text-slate-400"
                    )}>
                        {item.lib_com || "—"}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                {isDeleted ? (
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 font-bold text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60 border-emerald-300 dark:border-emerald-800 rounded-xl gap-1.5 shadow-sm transition-all cursor-pointer"
                        onClick={handleSoftDelete}
                        disabled={isLoading}
                        title="Restore combination"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restore Item
                    </Button>
                ) : (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => setIsEditOpen(true)} disabled={isLoading}>
                            <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                            onClick={handleSoftDelete}
                            disabled={isLoading}
                            title="Archive Combination"
                        >
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </div>

            <EditComboDialog
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                item={item}
                master={master}
                code1Label={code1Label}
                code2Label={code2Label}
                code1Desc={code1Map.get(item.code_1)}
                code2Desc={code2Map.get(item.code_2)}
                options={options}
                onSuccess={onRefresh}
            />
        </div>
    );
}

// Create Combo Dialog
function CreateComboDialog({
    open,
    onOpenChange,
    master,
    options,
    onSuccess
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    master: LibMaster;
    options: ComboOptions;
    onSuccess: () => void;
}) {
    const [loading, setLoading] = useState(false);
    const [code1, setCode1] = useState("");
    const [code2, setCode2] = useState("");

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        const payload = {
            code_1: formData.get("code_1"),
            code_2: formData.get("code_2"),
            lib_com: formData.get("lib_com"),
        };

        try {
            const res = await fetch(`/api/library/combo/${encodeURIComponent(master.lib_code)}`, {
                method: "POST",
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (res.ok) {
                toast.success("Combination created successfully");
                onOpenChange(false);
                onSuccess();
                setCode1("");
                setCode2("");
            } else {
                toast.error(data.error || "Failed to create combination");
            }
        } catch (error) {
            toast.error("Error creating combination");
        } finally {
            setLoading(false);
        }
    }

    console.log("Options data:", options);
    console.log("Code 1 options:", options.code1_options);
    console.log("Code 2 options:", options.code2_options);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add New Combination - {master.lib_name || master.lib_desc}</DialogTitle>
                    <DialogDescription>Create a new combination for the <strong>{master.lib_name || master.lib_desc}</strong> category.</DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="code_1">{options.code1_label || "Code 1"}</Label>
                        <Select value={code1} onValueChange={setCode1} required>
                            <SelectTrigger>
                                <SelectValue placeholder={`Select ${options.code1_label || "Code 1"}`} />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                {options.code1_options && options.code1_options.length > 0 ? (
                                    options.code1_options.map(opt => (
                                        <SelectItem key={opt.lib_id} value={opt.lib_id}>
                                            {opt.lib_id} - {opt.lib_desc}
                                        </SelectItem>
                                    ))
                                ) : (
                                    <div className="p-2 text-sm text-muted-foreground">No options available</div>
                                )}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Tip: Start typing to search</p>
                        <input type="hidden" name="code_1" value={code1} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="code_2">{options.code2_label || "Code 2"}</Label>
                        <Select value={code2} onValueChange={setCode2} required>
                            <SelectTrigger>
                                <SelectValue placeholder={`Select ${options.code2_label || "Code 2"}`} />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                {options.code2_options && options.code2_options.length > 0 ? (
                                    options.code2_options.map(opt => (
                                        <SelectItem key={opt.lib_id} value={opt.lib_id}>
                                            {opt.lib_id} - {opt.lib_desc}
                                        </SelectItem>
                                    ))
                                ) : (
                                    <div className="p-2 text-sm text-muted-foreground">No options available</div>
                                )}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Tip: Start typing to search</p>
                        <input type="hidden" name="code_2" value={code2} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="lib_com">Comments (Optional)</Label>
                        <Textarea id="lib_com" name="lib_com" placeholder="Additional notes..." className="min-h-[100px]" />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button type="submit" disabled={loading || !code1 || !code2}>
                            {loading ? "Creating..." : "Create"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// Edit Combo Dialog
function EditComboDialog({
    open,
    onOpenChange,
    item,
    master,
    code1Label,
    code2Label,
    code1Desc,
    code2Desc,
    options,
    onSuccess
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: ComboItem;
    master: LibMaster;
    code1Label: string;
    code2Label: string;
    code1Desc?: string;
    code2Desc?: string;
    options: ComboOptions;
    onSuccess: () => void;
}) {
    const [loading, setLoading] = useState(false);
    const [code2, setCode2] = useState(item.code_2);

    useEffect(() => {
        setCode2(item.code_2);
    }, [item]);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        const payload = {
            lib_com: formData.get("lib_com"),
            code_2: code2 !== item.code_2 ? code2 : undefined
        };

        try {
            const res = await fetch(`/api/library/combo/${encodeURIComponent(master.lib_code)}/${encodeURIComponent(item.code_1)}-${encodeURIComponent(item.code_2)}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                toast.success("Combination updated successfully");
                onOpenChange(false);
                onSuccess();
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to update combination");
            }
        } catch (error) {
            toast.error("Error updating combination");
        } finally {
            setLoading(false);
        }
    }

    const canEditCode2 = options.code2_options && options.code2_options.length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Combination - {master.lib_name || master.lib_desc}</DialogTitle>
                    <DialogDescription>
                        Editing combination in <strong>{master.lib_name || master.lib_desc}</strong> category.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={onSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>{code1Label} (Read-only)</Label>
                        <Input
                            value={`${item.code_1} - ${code1Desc || ''}`}
                            disabled
                            className="bg-slate-100 dark:bg-slate-900 cursor-not-allowed opacity-70"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>{code2Label} {canEditCode2 ? "" : "(Read-only)"}</Label>
                        {canEditCode2 ? (
                            <>
                                <Select value={code2} onValueChange={setCode2}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={`Select ${code2Label}`} />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                        {options.code2_options.map(opt => (
                                            <SelectItem key={opt.lib_id} value={opt.lib_id}>
                                                {opt.lib_id} - {opt.lib_desc}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <input type="hidden" name="code_2" value={code2} />
                            </>
                        ) : (
                            <Input
                                value={`${item.code_2} - ${code2Desc || ''}`}
                                disabled
                                className="bg-slate-100 dark:bg-slate-900 cursor-not-allowed opacity-70"
                            />
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="lib_com">Comments</Label>
                        <Textarea id="lib_com" name="lib_com" defaultValue={item.lib_com || ''} className="min-h-[100px]" />
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
