'use client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"

const jobPackSchema = z.object({
  action: z.enum(["createNew", "modify", "delete", "consolidate"]),
  type: z.enum(["structure", "component", "componentType"]),
  scope: z.object({
    topside: z.boolean(),
    subsea: z.boolean()
  })
})

type JobPackData = z.infer<typeof jobPackSchema>

export default function JobPackPage() {
  const form = useForm<JobPackData>({
    resolver: zodResolver(jobPackSchema),
    defaultValues: {
      scope: {
        topside: false,
        subsea: false
      }
    }
  })

  const onSubmit = (data: JobPackData) => {
    console.log(data)
  }

  return (
    <div className="flex-1 w-full flex flex-col">
      <div className="flex flex-col items-start">
        <h2 className="font-bold text-2xl">Job Pack</h2>
      </div>

      <div className="container mx-auto py-10">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="border rounded-md p-6 bg-card">
              <div className="text-blue-500 mb-4">
                Select any of the choice and press Next Button to Continue or Close Button to Exit
              </div>
              
              <div className="grid gap-6">
                <FormField
                  control={form.control}
                  name="action"
                  render={({ field }) => (
                    <FormItem className="space-y-4">
                      <div className="flex flex-col gap-2">
                        {[
                          { value: 'createNew', label: 'Create New Jobpack' },
                          { value: 'modify', label: 'Modify Jobpack' },
                          { value: 'delete', label: 'Delete Jobpack' },
                          { value: 'consolidate', label: 'Consolidate Jobpack' }
                        ].map((action) => (
                          <label key={action.value} className="flex items-center gap-2">
                            <input
                              type="radio"
                              {...field}
                              value={action.value}
                              checked={field.value === action.value}
                            />
                            {action.label}
                          </label>
                        ))}
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem className="border rounded-md p-4">
                      <div className="flex flex-col gap-2">
                        {[
                          { value: 'structure', label: 'Structure' },
                          { value: 'component', label: 'Component' },
                          { value: 'componentType', label: 'Component Type' }
                        ].map((type) => (
                          <label key={type.value} className="flex items-center gap-2">
                            <input
                              type="radio"
                              {...field}
                              value={type.value}
                              checked={field.value === type.value}
                            />
                            {type.label}
                          </label>
                        ))}
                      </div>
                    </FormItem>
                  )}
                />

                <div className="border rounded-md p-4">
                  <div className="flex gap-8">
                    <FormField
                      control={form.control}
                      name="scope.topside"
                      render={({ field }) => (
                        <FormItem>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                            />
                            Topside
                          </label>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="scope.subsea"
                      render={({ field }) => (
                        <FormItem>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                            />
                            Subsea
                          </label>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="outline" type="button">
                  Close
                </Button>
                <Button type="submit">
                  Next
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}