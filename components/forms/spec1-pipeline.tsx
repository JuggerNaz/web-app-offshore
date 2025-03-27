"use client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
} from "@/components/ui/form"
import { PipelineSchema } from "@/utils/schemas/zod"
import { useEffect, useState } from "react"
import { RowWrap, ColWrap } from "@/components/forms/utils"
import { CollapsibleField } from "@/components/forms/utils"
import { FormFieldWrap } from "./form-field-wrap"
import { fetcher } from "@/utils/utils";
import {mutate} from "swr";
import { toast } from "sonner"
import { Separator } from "../ui/separator"

const formSchema = z.object({
    username: z.string().min(2, {
      message: "Username must be at least 2 characters.",
    }),
})

type Props = {
    data?: any //TODO: use real type rather than any
}

export default function Spec1Pipeline ({data}: Props) {
    const form = useForm<z.infer<typeof PipelineSchema>>({
        resolver: zodResolver(PipelineSchema),
        // defaultValues: {
        //   TITLE: data?.Spec1.TITLE,
        // },
    })

    const onSubmit = async (values: z.infer<typeof PipelineSchema>) => {
        // Do something with the form values.
        // ✅ This will be type-safe and validated.
        await fetcher(`/api/platform/${values.pipe_id}`, {
            method: 'PUT',
            body: JSON.stringify(values)
        })
        .then((res) => {
            // mutate(`/api/comment/${pageId}`) //if want to mutate
            toast("Platform updated successfully")
        })

        console.log(values)
    }
    
    useEffect(() => {
        form.reset(data)
    }, [data])

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <RowWrap>
                    <ColWrap>
                        <FormFieldWrap label="Title" name="title" form={form} placeholder="title" />
                        <FormFieldWrap label="Oil Field" name="pfield" form={form} placeholder="oil field" />
                        <FormFieldWrap label="Inst. Date" name="inst_date" form={form} placeholder="instantiate date" />                            
                    </ColWrap>
                    <ColWrap>
                        <FormFieldWrap label="Description" name="pdesc" form={form} placeholder="description" />
                        <FormFieldWrap label="Depth" name="depth" form={form} placeholder="depth" description="m" />
                        <FormFieldWrap label="Design Life" name="desg_life" form={form} placeholder="design life" description="year" />
                    </ColWrap>
                    <ColWrap>
                        <FormFieldWrap label="Medium" name="ptype" form={form} placeholder="" />
                        <FormFieldWrap label="Process" name="process" form={form} placeholder="" />
                    </ColWrap>
                </RowWrap>
                <Separator />
                <RowWrap>
                    <ColWrap>
                        <div className="font-bold text-center">
                            Location
                        </div>
                        <FormFieldWrap label="STARTS AT" name="st_loc" form={form} placeholder="" />
                        <FormFieldWrap label="ENDS AT" name="end_loc" form={form} placeholder="" />
                    </ColWrap>
                    <ColWrap>
                        <div className="font-bold text-center">
                            KP
                        </div>
                        <FormFieldWrap label="" name="st_fp" form={form} placeholder="" description="m" />
                        <FormFieldWrap label="" name="end_fp" form={form} placeholder="" description="m" />
                    </ColWrap>
                    <ColWrap>
                        <div className="font-bold text-center">
                            Easting
                        </div>
                        <FormFieldWrap label="" name="st_x" form={form} placeholder="" description="m" />
                        <FormFieldWrap label="" name="end_x" form={form} placeholder="" description="m" />
                    </ColWrap>
                    <ColWrap>
                        <div className="font-bold text-center">
                            Northing
                        </div>
                        <FormFieldWrap label="" name="st_y" form={form} placeholder="" description="m" />
                        <FormFieldWrap label="" name="end_y" form={form} placeholder="" description="m" />
                    </ColWrap>
                </RowWrap>
                <Separator />
                <RowWrap>
                    <div className="flex-col w-4/5 space-y-5"><div className="     "></div>
                    <RowWrap>
                        <ColWrap>
                            <FormFieldWrap label="Length" name="plength" form={form} placeholder="" ftype="vertical" description="km" />
                        </ColWrap>
                        <ColWrap>
                            <FormFieldWrap label="Diameter" name="line_diam" form={form} placeholder="" ftype="vertical" description="mm" />
                        </ColWrap>
                        <ColWrap>
                            <FormFieldWrap label="Wall Thicknees" name="wall_thk" form={form} placeholder="" ftype="vertical" description="mm" />
                        </ColWrap>
                        <ColWrap>
                            <FormFieldWrap label="Material" name="material" form={form} placeholder="" ftype="vertical" />
                        </ColWrap>
                    </RowWrap>
                    <RowWrap>
                        <ColWrap>
                            <FormFieldWrap label="CP System" name="cp_system" form={form} placeholder="" ftype="vertical" />
                            <FormFieldWrap label="Design Pressure" name="desg_press" form={form} placeholder="" ftype="vertical" description="bars" />
                            <FormFieldWrap label="Constructional Span" name="span_cons" form={form} placeholder="" ftype="vertical" description="m" />
                        </ColWrap>
                        <ColWrap>
                            <FormFieldWrap label="Corrosion Coating" name="corr_ctg" form={form} placeholder="" ftype="vertical" />
                            <FormFieldWrap label="Operating Pressure" name="oper_press" form={form} placeholder="" ftype="vertical" description="bars" />
                            <FormFieldWrap label="Operational Span" name="span_oper" form={form} placeholder="" ftype="vertical" description="m" />
                        </ColWrap>
                        <ColWrap>
                            <div className="flex gap-2">
                                <FormFieldWrap label="Concrete Coating" name="conc_ctg" form={form} placeholder="" ftype="vertical" formControlClass="grow" />
                                <FormFieldWrap label="&nbsp;" name="conc_ctg_per" form={form} placeholder="" ftype="vertical" description="%" formControlClass="w-[50px] text-center" />
                            </div>
                            <FormFieldWrap label="Line Burried" name="burial" form={form} placeholder="" ftype="vertical" description="%" />
                            <FormFieldWrap label="Installation Contractor" name="inst_ctr" form={form} placeholder="" ftype="vertical" />
                        </ColWrap>
                    </RowWrap>
                    </div>
                    <div className="flex flex-col border rounded w-1/5 p-5 justify-between">
                        <div>The default unit that to be applied for this platform, its components and inspections.</div>
                        <FormFieldWrap label="" name="def_unit" form={form} placeholder="default unit" ftype="vertical" />
                    </div>
                </RowWrap>
                
                <Button type="submit">Submit</Button>
            </form>
      </Form>
    )
}