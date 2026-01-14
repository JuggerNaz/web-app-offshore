"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import {
    Search,
    Plus,
    Trash2,
    RefreshCcw,
    Edit,
    Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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

// Types
interface LibMaster {
    lib_code: string;
    lib_name: string;
    lib_desc: string;
}

interface ComboItem {
    id: number;
    lib_code: string;
    code_1: string;
    code_2: string;
    workunit?: string;
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
        const searchStr = searchTerm.toLowerCase();
        const code1Desc = code1Map.get(item.code_1) || item.code_1;
        const code2Desc = code2Map.get(item.code_2) || item.code_2;
        return (
            item.code_1.toLowerCase().includes(searchStr) ||
            item.code_2.toLowerCase().includes(searchStr) ||
            code1Desc.toLowerCase().includes(searchStr) ||
            code2Desc.toLowerCase().includes(searchStr) ||
            (item.workunit && item.workunit.toLowerCase().includes(searchStr))
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
                                key={item.id}
                                item={item}
                                master={master}
                                code1Map={code1Map}
                                code2Map={code2Map}
                                code1Label={options.code1_label}
                                code2Label={options.code2_label}
                                onRefresh={refreshItems}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 border-2 border-dashed rounded-xl">
                        <p className="text-muted-foreground">No combinations found.</p>
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
    onRefresh
}: {
    item: ComboItem;
    master: LibMaster;
    code1Map: Map<string, string>;
    code2Map: Map<string, string>;
    code1Label: string;
    code2Label: string;
    onRefresh: () => void;
}) {
    const isDeleted = item.lib_delete === 1;
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSoftDelete = async () => {
        if (!confirm("Are you sure you want to delete this combination?")) return;
        setIsLoading(true);
        try {
            const newStatus = isDeleted ? 0 : 1;
            const res = await fetch(`/api/library/combo/${encodeURIComponent(master.lib_code)}/${item.id}`, {
                method: "PUT",
                body: JSON.stringify({ lib_delete: newStatus }),
            });

            if (res.ok) {
                toast.success(isDeleted ? "Combination restored" : "Combination deleted");
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
                <div className="col-span-4 flex flex-col">
                    <span className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">{code1Label}</span>
                    <span className={`text-sm font-semibold ${isDeleted ? "text-red-700 dark:text-red-400 line-through" : "text-blue-700 dark:text-blue-400"}`}>
                        {item.code_1}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        {code1Map.get(item.code_1) || "—"}
                    </span>
                </div>
                <div className="col-span-4 flex flex-col">
                    <span className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">{code2Label}</span>
                    <span className={`text-sm font-semibold ${isDeleted ? "text-red-700 dark:text-red-400 line-through" : "text-blue-700 dark:text-blue-400"}`}>
                        {item.code_2}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                        {code2Map.get(item.code_2) || "—"}
                    </span>
                </div>
                <div className="col-span-4 flex flex-col">
                    <span className="text-[10px] uppercase text-slate-400 font-bold mb-0.5">Work Unit</span>
                    <span className={`text-sm ${isDeleted ? "text-red-400" : "text-slate-500 dark:text-slate-400"} truncate`}>
                        {item.workunit || "—"}
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

            <EditComboDialog
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                item={item}
                master={master}
                code1Label={code1Label}
                code2Label={code2Label}
                code1Desc={code1Map.get(item.code_1)}
                code2Desc={code2Map.get(item.code_2)}
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
                            <SelectContent>
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
                        <input type="hidden" name="code_1" value={code1} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="code_2">{options.code2_label || "Code 2"}</Label>
                        <Select value={code2} onValueChange={setCode2} required>
                            <SelectTrigger>
                                <SelectValue placeholder={`Select ${options.code2_label || "Code 2"}`} />
                            </SelectTrigger>
                            <SelectContent>
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
                        <input type="hidden" name="code_2" value={code2} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="lib_com">Work Unit (Optional)</Label>
                        <Input id="lib_com" name="lib_com" placeholder="e.g., 000" defaultValue="000" className="font-mono" />
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
    onSuccess: () => void;
}) {
    const [loading, setLoading] = useState(false);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        const payload = {
            lib_com: formData.get("lib_com"),
        };

        try {
            const res = await fetch(`/api/library/combo/${encodeURIComponent(master.lib_code)}/${item.id}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                toast.success("Combination updated successfully");
                onOpenChange(false);
                onSuccess();
            } else {
                toast.error("Failed to update combination");
            }
        } catch (error) {
            toast.error("Error updating combination");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Combination - {master.lib_name || master.lib_desc}</DialogTitle>
                    <DialogDescription>
                        Editing combination in <strong>{master.lib_name || master.lib_desc}</strong> category. The codes cannot be changed.
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
                        <Label>{code2Label} (Read-only)</Label>
                        <Input
                            value={`${item.code_2} - ${code2Desc || ''}`}
                            disabled
                            className="bg-slate-100 dark:bg-slate-900 cursor-not-allowed opacity-70"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="lib_com">Work Unit</Label>
                        <Input id="lib_com" name="lib_com" defaultValue={item.workunit || '000'} className="font-mono" />
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
