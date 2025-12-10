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
import { Plus } from "lucide-react";

type ComponentCommentDialogProps = {
  componentId: number;
};

export function ComponentCommentDialog({ componentId }: ComponentCommentDialogProps) {
  const [comment, setComment] = useState("");
  const [open, setOpen] = useState(false);

  const SubmitComment = async (e: any) => {
    e.preventDefault();
    
    await fetcher(`/api/comment`, {
      method: "POST",
      body: JSON.stringify({
        component_id: componentId,
        text: comment,
      }),
    }).then((res) => {
      setOpen(false);
      mutate(`/api/comment/component/${componentId}`);
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
          <DialogDescription>Add your comment for this component.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid items-center gap-4">
            <Textarea
              placeholder="Type your message here."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
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
