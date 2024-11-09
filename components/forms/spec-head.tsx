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
import { useEffect } from "react"

const formSchema = z.object({
    username: z.string().min(2, {
      message: "Username must be at least 2 characters.",
    }),
})

export const ColWrap = ({
    children,
  }: {
    children: React.ReactNode;
  }) => {
    return (
      <div className="flex flex-col w-1/3 gap-2">
          {children}
      </div>
    )
}

type Props = {
    data?: any //TODO: use real type rather than any
}

export default function SpecHead ({data}: Props) {
    // const form = useForm<z.infer<typeof formSchema>>({
    //     resolver: zodResolver(formSchema),
    //     defaultValues: {
    //       username: "",
    //     },
    // })

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
                <div className="flex justify-items-stretch gap-5">
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
                                {/* <FormDescription>
                                This is your public display name.
                                </FormDescription> */}
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
                                {/* <FormDescription>
                                This is your public display name.
                                </FormDescription> */}
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </ColWrap>
                    
                </div>
                <Button type="submit">Submit</Button>
            </form>
      </Form>
    )
}