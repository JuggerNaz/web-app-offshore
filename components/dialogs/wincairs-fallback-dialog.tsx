"use client";

import React, { useState, useMemo } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Search, Box, Info } from "lucide-react";

interface FallbackComponent {
    id: number;
    comp_id?: number;
    q_id: string;
    code: string | null;
}

interface WincairsFallbackDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fallbackComponents: FallbackComponent[];
    platformTitle?: string;
    onSelectComponent?: (comp: FallbackComponent) => void;
}

export function WincairsFallbackDialog({
    open,
    onOpenChange,
    fallbackComponents,
    platformTitle,
    onSelectComponent,
}: WincairsFallbackDialogProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredComponents = useMemo(() => {
        if (!searchQuery.trim()) return fallbackComponents;
        const q = searchQuery.toLowerCase().trim();
        return fallbackComponents.filter((c) =>
            c.q_id.toLowerCase().includes(q) ||
            (c.code && c.code.toLowerCase().includes(q)) ||
            c.id.toString().includes(q)
        );
    }, [fallbackComponents, searchQuery]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
                <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-black uppercase tracking-tight text-slate-900 dark:text-white">
                                WINCAIRS Fallback Components
                            </DialogTitle>
                            <DialogDescription className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                {platformTitle ? `${platformTitle} • ` : ""}
                                {fallbackComponents.length} component(s) using standard procedural math (missing 3D CAD records)
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {/* Search Bar */}
                <div className="relative my-3">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search fallback component by Q_ID or Code..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs"
                    />
                </div>

                {/* Info Notice */}
                <div className="p-3 mb-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <span>
                        When WINCAIRS Mode is active, the viewer applies 3D CAD vectors from <code className="font-mono text-blue-600 dark:text-blue-400">u_obj3d_param</code>. These listed components lack 3D vector entries and are seamlessly rendered using standard procedural elevation math.
                    </span>
                </div>

                {/* Components Table / List */}
                <div className="flex-1 overflow-y-auto max-h-[350px] pr-1 space-y-1.5 scrollbar-thin">
                    {filteredComponents.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center">
                            <Box className="h-8 w-8 text-slate-300 mb-2" />
                            <p className="text-xs font-bold text-slate-500">No fallback components found</p>
                        </div>
                    ) : (
                        filteredComponents.map((comp) => (
                            <div
                                key={comp.id}
                                onClick={() => {
                                    if (onSelectComponent) {
                                        onSelectComponent(comp);
                                        onOpenChange(false);
                                    }
                                }}
                                className="p-3 rounded-2xl bg-slate-50 hover:bg-amber-500/5 dark:bg-slate-950 dark:hover:bg-amber-500/10 border border-slate-100 dark:border-slate-800/80 hover:border-amber-500/30 transition-all flex items-center justify-between group cursor-pointer"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-[10px] font-black text-slate-600 dark:text-slate-300 shadow-xs">
                                        {comp.code || "COMP"}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                            {comp.q_id}
                                        </p>
                                        <p className="text-[10px] font-medium text-slate-400">
                                            ID: {comp.comp_id || comp.id}
                                        </p>
                                    </div>
                                </div>
                                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                                    Procedural Math
                                </span>
                            </div>
                        ))
                    )}
                </div>

                <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl text-xs font-bold"
                    >
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
