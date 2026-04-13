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
import { urlId } from "@/utils/client-state";
import React, { useState } from "react";
import { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ElevationSchema } from "@/utils/schemas/zod";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { FormFieldWrap } from "@/components/forms/form-field-wrap";
import { Plus, Ruler, Save } from "lucide-react";

export function ElevationDialog() {
  const [pageId] = useAtom(urlId);
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof ElevationSchema>>({
    resolver: zodResolver(ElevationSchema),
    defaultValues: {
      workunit: "m",
    }
  });

  const onSubmit = async (values: z.infer<typeof ElevationSchema>) => {
    const elevObject = {
      ...values,
      elv: values.orient === "BELOW" ? -Math.abs(values.elv || 0) : Math.abs(values.elv || 0),
      plat_id: pageId,
      cr_user: "",
    };

    try {
      await fetcher(`/api/platform/elevation`, {
        method: "POST",
        body: JSON.stringify(elevObject),
      });
      mutate(`/api/platform/elevation/${pageId}`);
      toast.success("Elevation created successfully");
      setOpen(false);
      form.reset();
    } catch (error) {
      toast.error("Failed to update elevation");
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
          <Plus className="h-4 w-4 text-blue-500" />
          New Elevation
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-b relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Ruler className="h-24 w-24 -rotate-12" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Add Elevation</DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Structure Reference Point</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2">
                <FormFieldWrap
                  label="Elevation Value"
                  name="elv"
                  form={form}
                  placeholder="0.00"
                  ftype="normal"
                  type="number"
                  description="Required value in meters"
                />
              </div>
              <FormFieldWrap
                label="Orientation"
                name="orient"
                options={[
                  { label: "Above Splash", value: "ABOVE" },
                  { label: "Below Splash", value: "BELOW" },
                ]}
                form={form}
                ftype="select"
              />
              <FormFieldWrap
                label="Work Unit"
                name="workunit"
                form={form}
                placeholder="m"
                ftype="normal"
                maxLength="3"
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
                className="rounded-xl font-bold px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 gap-2"
              >
                <Save className="h-4 w-4" />
                Register Elevation
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
