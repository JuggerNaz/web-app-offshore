"use client"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Spec1Schema, PlatformSchema } from "@/utils/schemas/zod"
import { useEffect, useState } from "react"
import { RowWrap, ColWrap } from "@/components/forms/utils"
import { FormFieldCollapsible, CollapsibleField } from "@/components/forms/utils"
import { FormFieldWrap } from "./form-field-wrap"

const formSchema = z.object({
    username: z.string().min(2, {
      message: "Username must be at least 2 characters.",
    }),
})

type Props = {
    data?: any //TODO: use real type rather than any
}

export default function Spec1 ({data}: Props) {
    const form = useForm<z.infer<typeof PlatformSchema>>({
        resolver: zodResolver(PlatformSchema),
        // defaultValues: {
        //   TITLE: data?.Spec1.TITLE,
        // },
    })

    const onSubmit = (values: z.infer<typeof PlatformSchema>) => {
        // Do something with the form values.
        // ✅ This will be type-safe and validated.
        console.log(values)
    }
    
    useEffect(() => {
        console.log(data)
        form.reset(data)
    }, [data])

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <CollapsibleField title="Detail Head">
                    <RowWrap>
                        <ColWrap>
                            <FormFieldWrap label="Title" name="title" form={form} placeholder="title" />
                            <FormFieldWrap label="Oil Field" name="pfield" form={form} placeholder="oil field" />
                            <FormFieldWrap label="Inst. Date" name="inst_date" form={form} placeholder="instantiate date" />                            
                        </ColWrap>
                        <ColWrap>
                            <FormFieldWrap label="Description" name="pdesc" form={form} placeholder="description" />
                            <FormFieldWrap label="Depth (m)" name="depth" form={form} placeholder="depth" />
                            <FormFieldWrap label="Design Life" name="desg_life" form={form} placeholder="design life" />
                        </ColWrap>
                        <ColWrap>
                            <FormFieldWrap label="Type" name="ptype" form={form} placeholder="type" />
                            <FormFieldWrap label="Function" name="ptype" form={form} placeholder="function" />
                        </ColWrap>
                    </RowWrap>
                </CollapsibleField>
                <RowWrap>
                    <div className="w-1/5 space-y-2">
                        <FormFieldWrap label="Norting" name="st_north" form={form} placeholder="northing" description="m" />
                        <FormFieldWrap label="Easting" name="st_east" form={form} placeholder="easting" description="m" />
                    </div>
                    <div className="w-3/5">
                        <div className="flex gap-3">
                            <div className="flex flex-col justify-center gap-2">
                                <FormFieldWrap label="No. of Legs" name="plegs" form={form} placeholder="" type="vertical"/>
                            </div>
                            <div className="flex flex-col gap-2">
                                <FormFieldWrap label="1:" name="leg_t1" form={form} placeholder="" type="small" />
                                <FormFieldWrap label="2:" name="leg_t2" form={form} placeholder="" type="small" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FormFieldWrap label="3:" name="leg_t3" form={form} placeholder="" type="small" />
                                <FormFieldWrap label="4:" name="leg_t4" form={form} placeholder="" type="small" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FormFieldWrap label="5:" name="leg_t5" form={form} placeholder="" type="small" />
                                <FormFieldWrap label="6:" name="leg_t6" form={form} placeholder="" type="small" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FormFieldWrap label="7:" name="leg_t7" form={form} placeholder="" type="small" />
                                <FormFieldWrap label="8:" name="leg_t8" form={form} placeholder="" type="small" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FormFieldWrap label="9:" name="leg_t9" form={form} placeholder="" type="small" />
                                <FormFieldWrap label="10:" name="leg_t10" form={form} placeholder="" type="small" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FormFieldWrap label="11:" name="leg_t11" form={form} placeholder="" type="small" />
                                <FormFieldWrap label="12:" name="leg_t12" form={form} placeholder="" type="small" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FormFieldWrap label="13:" name="leg_t13" form={form} placeholder="" type="small" />
                                <FormFieldWrap label="14:" name="leg_t14" form={form} placeholder="" type="small" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FormFieldWrap label="15:" name="leg_t15" form={form} placeholder="" type="small" />
                                <FormFieldWrap label="16:" name="leg_t16" form={form} placeholder="" type="small" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FormFieldWrap label="17:" name="leg_t17" form={form} placeholder="" type="small" />
                                <FormFieldWrap label="18:" name="leg_t18" form={form} placeholder="" type="small" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <FormFieldWrap label="19:" name="leg_t19" form={form} placeholder="" type="small" />
                                <FormFieldWrap label="20:" name="leg_t20" form={form} placeholder="" type="small" />
                            </div>
                        </div>
                    </div>
                    <div className="w-1/5 space-y-2">
                        <FormFieldWrap label="True North" name="north_angle" form={form} placeholder="true north" description="Deg." />
                        <FormFieldWrap label="North Side" name="north_side" form={form} placeholder="north side" />
                    </div>
                </RowWrap>
                <CollapsibleField title="Platform Legs">
                    <RowWrap>
                        
                    </RowWrap>
                </CollapsibleField>
                <Button type="submit">Submit</Button>
            </form>
      </Form>
    )
}