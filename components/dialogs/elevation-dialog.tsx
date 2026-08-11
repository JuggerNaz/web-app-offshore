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
import React, { useState, useEffect, useRef } from "react";
import { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ElevationSchema } from "@/utils/schemas/zod";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { FormFieldWrap } from "@/components/forms/form-field-wrap";
import { Plus, Ruler, Save, Edit } from "lucide-react";

interface ElevationDialogProps {
  itemToEdit?: any;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ElevationDialog({ itemToEdit, open: externalOpen, onOpenChange: externalOnOpenChange }: ElevationDialogProps = {}) {
  const [pageId] = useAtom(urlId);
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = (val: boolean) => {
    if (isControlled && externalOnOpenChange) {
      externalOnOpenChange(val);
    } else {
      setInternalOpen(val);
    }
  };

  const isEditing = !!itemToEdit;

  const form = useForm<z.infer<typeof ElevationSchema>>({
    resolver: zodResolver(ElevationSchema),
    defaultValues: {
      workunit: "000",
      orient: "ABOVE",
    }
  });

  const elv = form.watch("elv");
  const orient = form.watch("orient");
  const prevElv = useRef<any>(elv);
  const prevOrient = useRef<any>(orient);

  // Sync form data when opening in add or edit mode
  useEffect(() => {
    if (open) {
      if (itemToEdit) {
        const initialElv = itemToEdit.elv;
        const initialOrient = itemToEdit.orient || (initialElv >= 0 ? "ABOVE" : "BELOW");
        form.reset({
          elv: initialElv,
          orient: initialOrient,
          workunit: "000",
        });
        prevElv.current = initialElv;
        prevOrient.current = initialOrient;
      } else {
        form.reset({
          elv: undefined,
          orient: "ABOVE",
          workunit: "000",
        });
        prevElv.current = undefined;
        prevOrient.current = "ABOVE";
      }
    }
  }, [open, itemToEdit, form]);

  // Rule 1: When user enters a value (+ve or -ve), automatically set orientation
  useEffect(() => {
    if (elv !== prevElv.current) {
      prevElv.current = elv;
      const numElv = parseFloat(String(elv));
      if (!isNaN(numElv) && numElv !== 0) {
        if (numElv > 0 && orient !== "ABOVE") {
          form.setValue("orient", "ABOVE", { shouldValidate: true });
          prevOrient.current = "ABOVE";
        } else if (numElv < 0 && orient !== "BELOW") {
          form.setValue("orient", "BELOW", { shouldValidate: true });
          prevOrient.current = "BELOW";
        }
      }
    }
  }, [elv, orient, form]);

  // Rule 2: When user selects orientation, reset elevation sign accordingly (+ve for ABOVE, -ve for BELOW)
  useEffect(() => {
    if (orient !== prevOrient.current) {
      prevOrient.current = orient;
      const numElv = parseFloat(String(elv));
      if (!isNaN(numElv) && numElv !== 0) {
        if (orient === "ABOVE" && numElv < 0) {
          const updatedElv = Math.abs(numElv);
          form.setValue("elv", updatedElv, { shouldValidate: true });
          prevElv.current = updatedElv;
        } else if (orient === "BELOW" && numElv > 0) {
          const updatedElv = -Math.abs(numElv);
          form.setValue("elv", updatedElv, { shouldValidate: true });
          prevElv.current = updatedElv;
        }
      }
    }
  }, [orient, elv, form]);

  const onSubmit = async (values: z.infer<typeof ElevationSchema>) => {
    if (values.elv === undefined || values.elv === null || isNaN(Number(values.elv))) {
      toast.error("Please enter a valid elevation value");
      return;
    }

    const finalElv = values.orient === "BELOW" ? -Math.abs(Number(values.elv)) : Math.abs(Number(values.elv));

    try {
      if (isEditing) {
        await fetcher(`/api/platform/elevation`, {
          method: "PUT",
          body: JSON.stringify({
            plat_id: pageId,
            old_elv: itemToEdit.elv,
            elv: finalElv,
            orient: values.orient,
          }),
        });
        mutate(`/api/platform/elevation/${pageId}`);
        mutate(`/api/platform/level/${pageId}`);
        toast.success("Elevation updated successfully");
      } else {
        const elevObject = {
          ...values,
          elv: finalElv,
          workunit: "000",
          plat_id: pageId,
          cr_user: "",
        };

        await fetcher(`/api/platform/elevation`, {
          method: "POST",
          body: JSON.stringify(elevObject),
        });
        mutate(`/api/platform/elevation/${pageId}`);
        toast.success("Elevation created successfully");
      }
      setOpen(false);
    } catch (error) {
      toast.error(isEditing ? "Failed to update elevation" : "Failed to create elevation");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
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
      )}
      <DialogContent className="sm:max-w-[480px] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 bg-slate-50/50 dark:bg-slate-900/50 border-b relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Ruler className="h-24 w-24 -rotate-12" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              {isEditing ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">
                {isEditing ? "Edit Elevation" : "Add Elevation"}
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Structure Reference Point</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-8 space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <FormFieldWrap
                label="Elevation Value (m)"
                name="elv"
                form={form}
                placeholder="0.00"
                ftype="normal"
                type="number"
                description="Required value in meters (m) (+ve for Above Splash, -ve for Below Splash)"
              />
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
                {isEditing ? "Update Elevation" : "Register Elevation"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


