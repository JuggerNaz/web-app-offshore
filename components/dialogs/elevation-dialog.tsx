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
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ElevationSchema } from "@/utils/schemas/zod";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { FormFieldWrap } from "@/components/forms/form-field-wrap";
import { RowWrap, ColWrap } from "@/components/forms/utils";

export function ElevationDialog() {
  const [pageId, setPageId] = useAtom(urlId);
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof ElevationSchema>>({
    resolver: zodResolver(ElevationSchema),
  });

  const onSubmit = async (values: z.infer<typeof ElevationSchema>) => {
    const elevObject = values;
    elevObject.plat_id = pageId;
    elevObject.cr_user = "";

    await fetcher(`/api/platform/elevation`, {
      method: "POST",
      body: JSON.stringify(elevObject),
    }).then((res) => {
      mutate(`/api/platform/elevation/${pageId}`);
      toast("Elevation updated successfully");
      setOpen(false);
      form.reset();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Elevation</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Elevation</DialogTitle>
          <DialogDescription>Add structure elevation.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid items-center gap-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <RowWrap>
                  <ColWrap>
                    <FormFieldWrap
                      label="Elevation"
                      name="elv"
                      form={form}
                      placeholder=""
                      ftype="normal"
                      type="number"
                    />
                    <FormFieldWrap
                      label="Orientation"
                      name="orient"
                      options={[
                        { label: "Above", value: "ABOVE" },
                        { label: "Below", value: "BELOW" },
                      ]}
                      form={form}
                      ftype="select"
                    />
                    <FormFieldWrap
                      label="Work Unit"
                      name="workunit"
                      form={form}
                      placeholder=""
                      ftype="normal"
                      maxLength="3"
                    />
                  </ColWrap>
                </RowWrap>
                <div className="flex justify-end">
                  <Button type="submit">Submit</Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
        {/* <DialogFooter></DialogFooter> */}
      </DialogContent>
    </Dialog>
  );
}
