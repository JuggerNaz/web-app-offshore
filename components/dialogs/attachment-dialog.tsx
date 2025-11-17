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
import { Textarea } from "@/components/ui/textarea"
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import React, {ChangeEvent, useState} from "react";
import {mutate} from "swr";
import { fetcher } from "@/utils/utils";
import { toast } from "sonner"
import { Input } from "../ui/input";
import { Plus } from "lucide-react";

export function AttachmentDialog() {
    const [pageId, setPageId] = useAtom(urlId)
    const [formData, setFormData] = useState({
        filename: '',
        path: ''
    })
    const [open, setOpen] = useState(false)
    const [pageType, setPageType] = useAtom(urlType)
    const [file, setFile] = useState<File | null>(null)

    const SubmitAttachment = async (e: any) => {
        e.preventDefault()

        if(!file) return

        const data = new FormData()
        data.append('name', formData.filename)
        data.append('source_id', pageId.toString())
        data.append('source_type', pageType)
        data.append('file', file)

        await fetcher(`/api/attachment`, {
            method: 'POST',
            body: data
        }).then((res) => {
            setOpen(false)
            mutate(`/api/attachment/${pageType}/${pageId}`)
            setFormData({
                filename: '',
                path: ''
            })
            toast("Attachment added successfully")
        })
    }

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setFormData(prev => ({
          ...prev,
          [name]: value
        }));
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
          setFile(e.target.files[0])
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-8">
                    <Plus className="h-4 w-4 mr-2" />
                    Attachment
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                <DialogTitle>Attachment</DialogTitle>
                <DialogDescription>
                    Add your attachment for the structure.
                </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">          
                    <div className="grid items-center gap-4">
                        <Input 
                            placeholder="File name or leave blank for default"
                            name="filename"
                            defaultValue={formData.filename}
                            onInput={handleChange}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    SubmitAttachment(e)
                                }
                            }}
                        />
                        <Input
                            type="file"
                            onChange={handleFileChange}
                            className="mb-4"
                            accept="image/jpeg, image/png, application/pdf" 
                        />
                    </div>
                </div>
                <DialogFooter>
                <Button type="submit" onClick={SubmitAttachment}>Submit</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
