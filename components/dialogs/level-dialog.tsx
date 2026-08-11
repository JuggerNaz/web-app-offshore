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
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LevelSchema } from "@/utils/schemas/zod";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { FormFieldWrap } from "@/components/forms/form-field-wrap";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { Plus, Layers2, Save, Edit2 } from "lucide-react";

export interface LevelDialogProps {
  initialData?: any;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function LevelDialog({
  initialData,
  trigger,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: LevelDialogProps = {}) {
  const [pageId] = useAtom(urlId);
  const [internalOpen, setInternalOpen] = useState(false);
  const isEditing = !!initialData;

  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (externalOnOpenChange) externalOnOpenChange(value);
    setInternalOpen(value);
  };

  const form = useForm<z.infer<typeof LevelSchema>>({
    resolver: zodResolver(LevelSchema),
    defaultValues: {
      level_name: initialData?.level_name || "",
      elv_from: initialData?.elv_from?.toString() || "",
      elv_to: initialData?.elv_to?.toString() || "",
      workunit: initialData?.workunit || "m",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        level_name: initialData?.level_name || "",
        elv_from: initialData?.elv_from?.toString() || "",
        elv_to: initialData?.elv_to?.toString() || "",
        workunit: initialData?.workunit || "m",
      });
    }
  }, [open, initialData, form]);

  const { data: elvData } = useSWR(`/api/platform/elevation/${pageId}`, fetcher);

  const onSubmit = async (values: z.infer<typeof LevelSchema>) => {
    const levelObject = {
      ...values,
      plat_id: Number(pageId),
      cr_user: "",
      original_level_name: isEditing ? initialData?.level_name : undefined,
    };

    try {
      await fetcher(`/api/platform/level`, {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(levelObject),
      });
      mutate(`/api/platform/level/${pageId}`);
      toast.success(isEditing ? "Structural level updated successfully" : "Structural level created successfully");
      setOpen(false);
      if (!isEditing) form.reset();
    } catch (error) {
      toast.error(isEditing ? "Failed to update level" : "Failed to create level");
    }
  };

  const elevationOptions = elvData?.data?.map((x: any) => ({
    label: `${x.elv}m (${x.orient})`,
    value: x.elv.toString(),
  })) || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ? (
            trigger
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl font-bold h-9 px-4 gap-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all shadow-sm"
            >
              <Plus className="h-4 w-4 text-purple-500" />
              New Level
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[520px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-b relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Layers2 className="h-24 w-24 -rotate-12" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/20">
              {isEditing ? <Edit2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">
                {isEditing ? "Edit Level" : "Add Level"}
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Structural Hierarchy Definition
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-8 space-y-6">
            <div className="space-y-6">
              <FormFieldWrap
                label="Level Name"
                name="level_name"
                form={form}
                placeholder="e.g. UPPER DECK"
                ftype="normal"
              />

              <div className="grid grid-cols-2 gap-6">
                <FormFieldWrap
                  label="From Elevation"
                  name="elv_from"
                  options={elevationOptions}
                  form={form}
                  ftype="select"
                />
                <FormFieldWrap
                  label="To Elevation"
                  name="elv_to"
                  options={elevationOptions}
                  form={form}
                  ftype="select"
                />
              </div>

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
                className="rounded-xl font-bold px-8 bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/20 gap-2"
              >
                <Save className="h-4 w-4" />
                {isEditing ? "Save Changes" : "Register Level"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
