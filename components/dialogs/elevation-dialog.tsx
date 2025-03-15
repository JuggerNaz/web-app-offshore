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
import React, {useState} from "react";
import {mutate} from "swr";
import { fetcher } from "@/utils/utils";
import { toast } from "sonner"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { ElevationSchema } from "@/utils/schemas/zod";
import { z } from "zod"
import {
    Form,
  } from "@/components/ui/form"
import { FormFieldWrap } from "@/components/forms/form-field-wrap"
import { RowWrap, ColWrap } from "@/components/forms/utils"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"
import { FormSelect } from "@/components/forms/form-field-wrap";

export function ElevationDialog() {
    const [pageId, setPageId] = useAtom(urlId)
    const [comment, setComment] = useState("")
    const [open, setOpen] = useState(false)
    const [pageType, setPageType] = useAtom(urlType)

    const form = useForm<z.infer<typeof ElevationSchema>>({
            resolver: zodResolver(ElevationSchema),
            // defaultValues: {
            //   TITLE: data?.Spec1.TITLE,
            // },
        })

    const onSubmit = async (values: z.infer<typeof ElevationSchema>) => {
        // Do something with the form values.
        // ✅ This will be type-safe and validated.
        // await fetcher(`/api/platform/${values.plat_id}`, {
        //     method: 'PUT',
        //     body: JSON.stringify(values)
        // })
        // .then((res) => {
        //     // mutate(`/api/comment/${pageId}`) //if want to mutate
        //     toast("Platform updated successfully")
        // })

        console.log(values)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>Add Elevation</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Elevation</DialogTitle>
                    <DialogDescription>
                        Add structure elevation.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">          
                <div className="grid items-center gap-4">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                            <RowWrap>
                                <ColWrap>
                                    <FormFieldWrap label="Elevation" name="elv" form={form} placeholder="" ftype="vertical" type="number" />
                                    <FormFieldWrap label="Orientation" name="orient" options={[{label: 'Above', value: 'ABOVE'},{label: 'Below', value: 'BELOW'}]} form={form} ftype="select" />
                                    <FormFieldWrap label="Work Unit" name="workunit" form={form} placeholder="" ftype="vertical" />
                                </ColWrap>
                            </RowWrap>
                            <Button type="submit">Submit</Button>
                        </form>
                    </Form>
                </div>
                </div>
                {/* <DialogFooter></DialogFooter> */}
            </DialogContent>
        </Dialog>
    )
}
