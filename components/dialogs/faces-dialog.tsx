import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import React, { useState } from "react";
import { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { FacesSchema } from "@/utils/schemas/zod";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { FormFieldWrap } from "@/components/forms/form-field-wrap";
import useSWR from "swr";
import { Plus, Activity, Save } from "lucide-react";

export function FacesDialog() {
  const [pageId] = useAtom(urlId);
  const [open, setOpen] = useState(false);
  const [pageType] = useAtom(urlType);

  const form = useForm<z.infer<typeof FacesSchema>>({
    resolver: zodResolver(FacesSchema),
    defaultValues: {
      workunit: "m",
    }
  });

  const { data } = useSWR(`/api/${pageType}/${pageId}`, fetcher);

  const legs = data?.data ? Object.keys(data.data)
    .filter((x) => x.startsWith("leg_t"))
    .map((x) => ({ label: x.toUpperCase().replace('_', ' '), value: data.data[x] }))
    .filter((x) => x.value) : [];

  const onSubmit = async (values: z.infer<typeof FacesSchema>) => {
    const facesObject = {
      ...values,
      plat_id: Number(pageId),
      cr_user: "",
    };

    try {
      await fetcher(`/api/platform/faces`, {
        method: "POST",
        body: JSON.stringify(facesObject),
      });
      mutate(`/api/platform/faces/${pageId}`);
      toast.success("Structural face registered successfully");
      setOpen(false);
      form.reset();
    } catch (err) {
      toast.error("Failed to register faces");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl font-bold h-9 px-4 gap-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all shadow-sm"
        >
          <Plus className="h-4 w-4 text-emerald-500" />
          New Face
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[540px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-b relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Activity className="h-24 w-24 -rotate-12" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Register Face</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Structural Orientation Segment</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <FormFieldWrap
                label="Face Name"
                name="face"
                form={form}
                placeholder="e.g. FACE A"
                ftype="normal"
              />
              <FormFieldWrap
                label="Work Unit"
                name="workunit"
                form={form}
                placeholder="m"
                ftype="normal"
                maxLength="3"
              />
              <div className="col-span-2">
                <FormFieldWrap
                  label="Face Description"
                  name="face_desc"
                  form={form}
                  placeholder="e.g. North Side Bracing"
                  ftype="normal"
                />
              </div>
              <FormFieldWrap
                label="From Point"
                name="face_from"
                options={legs}
                form={form}
                ftype="select"
              />
              <FormFieldWrap
                label="To Point"
                name="face_to"
                options={legs}
                form={form}
                ftype="select"
              />
            </div>

            <div className="flex justify-end pt-4 gap-3">
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
                className="rounded-xl font-bold px-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 gap-2"
              >
                <Save className="h-4 w-4" />
                Confirm Face Mapping
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
