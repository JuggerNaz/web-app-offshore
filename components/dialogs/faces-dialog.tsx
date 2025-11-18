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
import { FacesSchema } from "@/utils/schemas/zod";
import { z } from "zod";
import { Form } from "@/components/ui/form";
import { FormFieldWrap } from "@/components/forms/form-field-wrap";
import { RowWrap, ColWrap } from "@/components/forms/utils";
import useSWR from "swr";

export function FacesDialog() {
  const [pageId, setPageId] = useAtom(urlId);
  const [open, setOpen] = useState(false);
  const [pageType, setPageType] = useAtom(urlType);

  const form = useForm<z.infer<typeof FacesSchema>>({
    resolver: zodResolver(FacesSchema),
  });

  const { data, error, isLoading } = useSWR(`/api/${pageType}/${pageId}`, fetcher);
  const legs = Object.keys(data.data)
    .filter((x) => x.startsWith("leg_t"))
    .map((x) => {
      return { label: x, value: data.data[x] };
    })
    .filter((x) => x.value);

  const onSubmit = async (values: z.infer<typeof FacesSchema>) => {
    const facesObject = values;
    facesObject.plat_id = pageId;
    facesObject.cr_user = "";
    console.log(facesObject);

    await fetcher(`/api/platform/faces`, {
      method: "POST",
      body: JSON.stringify(facesObject),
    }).then((res) => {
      mutate(`/api/platform/faces/${pageId}`);
      toast("Faces insert successfully");
      setOpen(false);
      form.reset();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Faces</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Faces</DialogTitle>
          <DialogDescription>Add structure faces.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid items-center gap-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <RowWrap>
                  <ColWrap>
                    <FormFieldWrap
                      label="Name"
                      name="face"
                      form={form}
                      placeholder=""
                      ftype="normal"
                      type="text"
                    />
                    <FormFieldWrap
                      label="Description"
                      name="description"
                      form={form}
                      placeholder=""
                      ftype="normal"
                      type="text"
                    />
                    <FormFieldWrap
                      label="From"
                      name="face_from"
                      options={legs}
                      form={form}
                      ftype="select"
                    />
                    <FormFieldWrap
                      label="To"
                      name="face_to"
                      options={legs}
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
