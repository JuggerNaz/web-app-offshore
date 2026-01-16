import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import React, { useState } from "react";
import { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { toast } from "sonner";
import { Plus, MessageSquareText, Send } from "lucide-react";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";

type ComponentCommentDialogProps = {
  componentId: number;
};

export function ComponentCommentDialog({ componentId }: ComponentCommentDialogProps) {
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  const [structureId] = useAtom(urlId);
  const [structureType] = useAtom(urlType);

  const SubmitComment = async (e: any) => {
    e.preventDefault();

    if (!structureId) {
      toast.error("No structure selected. Cannot add comment.");
      return;
    }

    await fetcher(`/api/comment`, {
      method: "POST",
      body: JSON.stringify({
        structure_id: structureId,
        structure_type: structureType,
        component_id: componentId,
        text: comment,
      }),
    }).then((res) => {
      setOpen(false);
      mutate(`/api/comment/component/${componentId}`);
      setComment("");
      toast.success("Comment added successfully");
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl font-bold h-9 px-4 gap-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all shadow-sm"
        >
          <Plus className="h-4 w-4 text-emerald-500" />
          Comment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-b relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <MessageSquareText className="h-24 w-24 -rotate-12" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Component Note</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Component Level Feedback
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <Textarea
              className="resize-none min-h-[120px] rounded-xl border-slate-200 dark:border-slate-800 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="Type your message here..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) {
                  SubmitComment(e);
                }
              }}
            />
            <p className="text-[10px] text-muted-foreground font-medium flex items-center justify-end gap-1">
              <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono">Ctrl + Enter</span> to submit
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="rounded-xl font-bold px-6"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={SubmitComment}
              className="rounded-xl font-bold px-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 gap-2"
            >
              <Send className="h-4 w-4" />
              Submit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
