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
import { Plus } from "lucide-react";

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
      toast("Comment added successfully");
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8">
          <Plus className="h-4 w-4 mr-2" />
          Comment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Comment</DialogTitle>
          <DialogDescription>Add your comment for the structure.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid items-center gap-4">
            <Textarea
              placeholder="Type your message here."
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
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={SubmitComment}>
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
