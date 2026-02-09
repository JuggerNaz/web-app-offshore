"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Trash2 } from "lucide-react";

interface DeleteConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    title?: string;
    description?: string;
    loading?: boolean;
}

export function DeleteConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    title = "Confirm Deletion",
    description = "Are you sure you want to permanently delete this item? This action cannot be undone.",
    loading = false,
}: DeleteConfirmDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-8 bg-rose-50/50 dark:bg-rose-950/20 border-b relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Trash2 className="h-24 w-24 -rotate-12" />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/20">
                            <AlertCircle className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight text-rose-600">
                                {title}
                            </DialogTitle>
                            <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                Permanent Action
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                        {description}
                    </p>
                </div>

                <DialogFooter className="p-6 bg-slate-50/50 dark:bg-slate-900/50 border-t flex sm:justify-end gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl font-bold px-6"
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            onConfirm();
                        }}
                        disabled={loading}
                        className="rounded-xl font-bold px-8 bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/20 gap-2"
                    >
                        {loading ? (
                            <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Trash2 className="h-4 w-4" />
                        )}
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
