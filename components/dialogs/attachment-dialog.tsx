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
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import React, { ChangeEvent, useState } from "react";
import { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { toast } from "sonner";
import { Input } from "../ui/input";
import { Plus, Paperclip, Upload } from "lucide-react";

export function AttachmentDialog() {
  const [pageId, setPageId] = useAtom(urlId);
  const [formData, setFormData] = useState({
    filename: "",
    path: "",
  });
  const [open, setOpen] = useState(false);
  const [pageType, setPageType] = useAtom(urlType);
  const [file, setFile] = useState<File | null>(null);

  const SubmitAttachment = async (e: any) => {
    e.preventDefault();

    if (!file) return;

    const data = new FormData();
    data.append("name", formData.filename);
    data.append("source_id", pageId.toString());
    data.append("source_type", pageType);
    data.append("file", file);

    try {
      await fetcher(`/api/attachment`, {
        method: "POST",
        body: data,
      });

      setOpen(false);
      mutate(`/api/attachment/${pageType}/${pageId}`);
      setFormData({
        filename: "",
        path: "",
      });
      setFile(null);
      toast.success("Attachment added successfully");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload attachment");
    }
  };

  const handleChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl font-bold h-9 px-4 gap-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all shadow-sm"
        >
          <Plus className="h-4 w-4 text-indigo-500" />
          Attachment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-b relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Paperclip className="h-24 w-24 -rotate-12" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Paperclip className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">New Attachment</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                File Upload
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">File Name</label>
              <Input
                placeholder="Enter display name or leave blank"
                name="filename"
                className="rounded-xl border-slate-200 dark:border-slate-800 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                defaultValue={formData.filename}
                onInput={handleChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    SubmitAttachment(e);
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Select File</label>
              <div
                className={`relative group rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all duration-300 p-8 text-center cursor-pointer ${file ? "bg-indigo-50/30 border-indigo-500/30" : ""
                  }`}
              >
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload className="h-12 w-12 text-indigo-500/20 scale-150 transform -rotate-12" />
                </div>
                <div className="relative z-10">
                  <Input
                    type="file"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    accept="image/jpeg, image/png, application/pdf"
                  />
                  {file ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 flex items-center justify-center">
                        <Paperclip className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-semibold text-indigo-600 truncate max-w-[200px]">
                        {file.name}
                      </span>
                      <span className="text-xs text-muted-foreground">Click to change</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors flex items-center justify-center">
                        <Upload className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground group-hover:text-indigo-600 transition-colors">
                        Click to upload a file
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                        Images or PDF
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
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
              onClick={SubmitAttachment}
              disabled={!file}
              className="rounded-xl font-bold px-8 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
