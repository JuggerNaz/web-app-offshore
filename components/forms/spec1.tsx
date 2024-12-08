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
import { Spec1Schema } from "@/utils/schemas/zod"
import { useEffect, useState } from "react"
import { RowWrap, ColWrap } from "@/components/forms/utils"
import { FormFieldCollapsible, CollapsibleField } from "@/components/forms/utils"

const formSchema = z.object({
    username: z.string().min(2, {
      message: "Username must be at least 2 characters.",
    }),
})

type Props = {
    data?: any //TODO: use real type rather than any
}

export default function Spec1 ({data}: Props) {
    const form = useForm<z.infer<typeof Spec1Schema>>({
        resolver: zodResolver(Spec1Schema),
        // defaultValues: {
        //   TITLE: data?.Spec1.TITLE,
        // },
    })

    const onSubmit = (values: z.infer<typeof Spec1Schema>) => {
        // Do something with the form values.
        // ✅ This will be type-safe and validated.
        console.log(values)
    }
    
    useEffect(() => {
        console.log(data)
        form.reset(data?.Spec1)
    }, [data])

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <CollapsibleField title="Detail Head">
                <RowWrap>
                    <ColWrap>
                        <FormField
                            control={form.control}
                            name="TITLE"
                            render={({ field }) => (
                            <FormItem className="">
                                <FormLabel>Title</FormLabel>
                                <FormControl>
                                    <Input placeholder="title" {...field} />
                                </FormControl>
                                {/* <FormDescription>
                                This is your public display name.
                                </FormDescription> */}
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="PFIELD"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Oil Field</FormLabel>
                                <FormControl>
                                    <Input placeholder="Oil field" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="INST_DATE"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Inst. Date</FormLabel>
                                <FormControl>
                                    <Input placeholder="Instantiate date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </ColWrap>
                    <ColWrap>
                        <FormField
                            control={form.control}
                            name="PDESC"
                            render={({ field }) => (
                            <FormItem className="">
                                <FormLabel>Description</FormLabel>
                                <FormControl>
                                    <Input placeholder="description" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="DEPTH"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Depth (m)</FormLabel>
                                <FormControl>
                                    <Input placeholder="depth" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="DESG_LIFE"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Design Life (Year)</FormLabel>
                                <FormControl>
                                    <Input placeholder="Design Life" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </ColWrap>
                    <ColWrap>
                        <FormField
                            control={form.control}
                            name="PTYPE"
                            render={({ field }) => (
                            <FormItem className="">
                                <FormLabel>Type</FormLabel>
                                <FormControl>
                                    <Input placeholder="Type" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="PTYPE"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Function</FormLabel>
                                <FormControl>
                                    <Input placeholder="function" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </ColWrap>
                </RowWrap>
            </CollapsibleField>
                <RowWrap>
                    <ColWrap>
                        <FormField
                            control={form.control}
                            name="ST_NORTH"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Norting (m)</FormLabel>
                                <FormControl>
                                    <Input placeholder="Northing" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="ST_EAST"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Easting (m)</FormLabel>
                                <FormControl>
                                    <Input placeholder="Northing" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </ColWrap>
                    <ColWrap>
                        <FormField
                            control={form.control}
                            name="NORTH_ANGLE"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>True North (Deg)</FormLabel>
                                <FormControl>
                                    <Input placeholder="degree" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="NORTH_SIDE"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Platform North</FormLabel>
                                <FormControl>
                                    <Input placeholder="platform north" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </ColWrap>
                </RowWrap>
                <CollapsibleField title="Platform Legs">
                    <RowWrap>
                        <ColWrap>
                            <FormField
                                control={form.control}
                                name="LEG_T1"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>No of Leg</FormLabel>
                                    <FormControl>
                                        <Input placeholder="No of leg" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="ST_EAST"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Easting (m)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Northing" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </ColWrap>
                        <ColWrap>
                            <FormField
                                control={form.control}
                                name="NORTH_ANGLE"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>True North (Deg)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="degree" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="NORTH_SIDE"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Platform North</FormLabel>
                                    <FormControl>
                                        <Input placeholder="platform north" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </ColWrap>
                    </RowWrap>
                </CollapsibleField>
                <Button type="submit">Submit</Button>
            </form>
      </Form>
    )
}