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
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import React, { useState } from "react";
import { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { toast } from "sonner";
import { Plus, MessageSquare, Send } from "lucide-react";

export function CommentDialog() {
  const [pageId, setPageId] = useAtom(urlId);
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);
  const [pageType, setPageType] = useAtom(urlType);

  const SubmitComment = async (e: any) => {
    //todo use proper event
    e.preventDefault();
    await fetcher(`/api/comment`, {
      method: "POST",
      body: JSON.stringify({
        structure_id: pageId,
        text: comment,
        structure_type: pageType,
      }),
    }).then((res) => {
      setOpen(false);
      mutate(`/api/comment/${pageType}/${pageId}`);
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
          <Plus className="h-4 w-4 text-blue-500" />
          Comment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-b relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <MessageSquare className="h-24 w-24 -rotate-12" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Add Comment</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Structure Feedback
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <Textarea
              className="resize-none min-h-[120px] rounded-xl border-slate-200 dark:border-slate-800 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              placeholder="Type your message here..."
              defaultValue={comment}
              onInput={(e: any) => {
                setComment(e.target.value);
              }}
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
              className="rounded-xl font-bold px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 gap-2"
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
