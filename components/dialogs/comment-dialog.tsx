import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function CommentDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Add Comment</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Comment</DialogTitle>
          <DialogDescription>
            Add your comment.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">          
          <div className="grid items-center gap-4">
            <Textarea placeholder="Type your message here." />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
