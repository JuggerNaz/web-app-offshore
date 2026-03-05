import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import React, { useState, useEffect } from "react";
import { mutate } from "swr";
import { toast } from "sonner";
import { MessageSquare, Send } from "lucide-react";

interface EditCommentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    commentItem: any;
}

export function EditCommentDialog({ open, onOpenChange, commentItem }: EditCommentDialogProps) {
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && commentItem) {
            setComment(commentItem.text || "");
        }
    }, [open, commentItem]);

    const SubmitComment = async (e: any) => {
        e.preventDefault();
        if (!comment.trim()) {
            toast.error("Comment cannot be empty");
            return;
        }

        try {
            setLoading(true);
            const res = await fetch(`/api/comment/${commentItem.structure_type}/${commentItem.structure_id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: commentItem.id,
                    text: comment,
                }),
            });

            if (res.ok) {
                toast.success("Comment updated successfully");
                mutate(`/api/comment/${commentItem.structure_type}/${commentItem.structure_id}`);
                onOpenChange(false);
            } else {
                toast.error("Failed to update comment");
            }
        } catch (err) {
            toast.error("Failed to update comment");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-b relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <MessageSquare className="h-24 w-24 -rotate-12" />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <MessageSquare className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Comment</DialogTitle>
                            <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                Modify Structure Feedback
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8 space-y-6">
                    <div className="space-y-2">
                        <Textarea
                            className="resize-none min-h-[120px] rounded-xl border-slate-200 dark:border-slate-800 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                            placeholder="Type your message here..."
                            value={comment}
                            onChange={(e: any) => setComment(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && e.ctrlKey) {
                                    SubmitComment(e);
                                }
                            }}
                        />
                        <p className="text-[10px] text-muted-foreground font-medium flex items-center justify-end gap-1">
                            <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">Ctrl + Enter</span> to save
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
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
                            type="submit"
                            onClick={SubmitComment}
                            disabled={loading}
                            className="rounded-xl font-bold px-8 bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-500/20 gap-2"
                        >
                            <Send className="h-4 w-4" />
                            {loading ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
