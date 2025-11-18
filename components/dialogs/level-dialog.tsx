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
import React, { useState } from "react";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { LevelSchema } from "@/utils/schemas/zod";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { FormFieldWrap } from "@/components/forms/form-field-wrap";
import { RowWrap, ColWrap } from "@/components/forms/utils";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/utils/utils";

export function LevelDialog() {
  const [pageId, setPageId] = useAtom(urlId);
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof LevelSchema>>({
    resolver: zodResolver(LevelSchema),
  });

  const {
    data: elvData,
    error: elvError,
    isLoading: elvIsLoading,
  } = useSWR(`/api/platform/elevation/${pageId}`, fetcher);

  const onSubmit = async (values: z.infer<typeof LevelSchema>) => {
    const levelObject = values;
    levelObject.plat_id = pageId;
    levelObject.cr_user = "";

    console.log(levelObject);

    await fetcher(`/api/platform/level`, {
      method: "POST",
      body: JSON.stringify(levelObject),
    }).then((res) => {
      mutate(`/api/platform/level/${pageId}`);
      toast("Level insert successfully");
      setOpen(false);
      form.reset();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Level</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Level</DialogTitle>
          <DialogDescription>Add structure level.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid items-center gap-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <RowWrap>
                  <ColWrap>
                    <FormFieldWrap
                      label="Name"
                      name="level_name"
                      form={form}
                      placeholder=""
                      ftype="normal"
                    />
                    <FormFieldWrap
                      label="From Elevation"
                      name="elv_from"
                      options={elvData.data.map((x: any) => {
                        return { label: x.elv.toString(), value: x.elv.toString() };
                      })}
                      form={form}
                      ftype="select"
                    />
                    <FormFieldWrap
                      label="To Elevation"
                      name="elv_to"
                      options={elvData.data.map((x: any) => {
                        return { label: x.elv.toString(), value: x.elv.toString() };
                      })}
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
