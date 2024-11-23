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
import { JobPackSchema } from "@/utils/schemas/zod"
import { useState } from "react"

export default function JobPackPage() {
  const [formData, setFormData] = useState<Partial<z.infer<typeof JobPackSchema>>>({})

  const form = useForm<z.infer<typeof JobPackSchema>>({
    resolver: zodResolver(JobPackSchema),
    defaultValues: {
      SCOPE: {
        TOPSIDE: false,
        SUBSEA: false
      }
    }
  })

  const onSubmit = (data: z.infer<typeof JobPackSchema>) => {
    setFormData(prev => ({ ...prev, ...data }))
    console.log('Form data:', data)
  }

  // Step 1: Initial Selection
  const Step1Content = () => (
    <div className="space-y-6">
      <div className="text-blue-500">
        Select any of the choice and press Next Button to Continue or Close Button to Exit
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="border rounded-md p-4">
          <FormField
            control={form.control}
            name="ACTION"
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
        </div>

        <div className="border rounded-md p-4">
          <FormField
            control={form.control}
            name="TYPE"
            render={({ field }) => (
              <FormItem>
                <div className="flex flex-col gap-2">
                  {[
                    { value: 'structure', label: 'Structure' },
                    { value: 'component', label: 'Component' }
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
        </div>
      </div>

      <div className="border rounded-md p-4">
        <div className="flex gap-8">
          <FormField
            control={form.control}
            name="SCOPE.TOPSIDE"
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
            name="SCOPE.SUBSEA"
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

      <div className="border rounded-md p-4">
        <div className="text-blue-500">
          {formData.ACTION === 'createNew' ? 'Create a new Jobpack' : 
           formData.ACTION === 'modify' ? 'Modifying JobPack' :
           formData.ACTION === 'delete' ? 'Delete JobPack' :
           formData.ACTION === 'consolidate' ? 'Consolidate JobPack' : ''}
        </div>
      </div>
    </div>
  )

  // Step 2: JobPack Details
  const Step2Content = () => (
    <div className="space-y-6">
      <div className="text-blue-500">JobPack Details :</div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block">Job Name:</label>
              <input type="text" className="border p-2 w-full" defaultValue="UIMC2022/SKA/PIPE1" />
            </div>
            <div>
              <label className="block">Plan Type:</label>
              <input type="text" className="border p-2 w-full" defaultValue="INSTANT" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block">Start Date:</label>
              <input type="text" className="border p-2 w-full" defaultValue="03-MAR-2022" />
            </div>
            <div>
              <label className="block">End:</label>
              <input type="text" className="border p-2 w-full" defaultValue="00- -0000" />
            </div>
          </div>
          <div>
            <label className="block">Contractor:</label>
            <input type="text" className="border p-2 w-full" defaultValue="ALAM MARITIM (M) SDN BHD" />
          </div>
          <div>
            <label className="block">Company Rep:</label>
            <input type="text" className="border p-2 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block">Vessel:</label>
              <input type="text" className="border p-2 w-full" defaultValue="MV PIONEER" />
            </div>
            <div>
              <label className="block">Dive Type:</label>
              <input type="text" className="border p-2 w-full" />
            </div>
          </div>
          <div>
            <label className="block">Contract Ref#:</label>
            <input type="text" className="border p-2 w-full" />
          </div>
          <div>
            <label className="block">Contractor Ref#:</label>
            <input type="text" className="border p-2 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block">Estimated Time:</label>
              <div className="flex">
                <input type="text" className="border p-2 w-full" />
                <span className="p-2 text-red-500">Hours</span>
              </div>
            </div>
            <div>
              <label className="block">Status:</label>
              <input type="text" className="border p-2 w-full" defaultValue="OPEN" />
            </div>
          </div>
          <div>
            <label className="block">Comments:</label>
            <textarea className="border p-2 w-full h-24" />
          </div>
        </div>
        <div>
          <div className="border p-4 mb-4">
            <div className="text-center mb-4">Contractor Logo:</div>
            <div className="w-32 h-32 mx-auto border"></div>
          </div>
          <div className="border p-4">
            <div className="mb-2">Contractor Address:</div>
            <div className="text-sm">
              ALAM MARITIM (M) SDN BHD<br />
              No. 38F, Level 3, Jalan Radin Anum,<br />
              Bandar Baru Sri Petaling,<br />
              57000 Kuala Lumpur
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // Step 3: Structure Selection
  const Step3Content = () => (
    <div className="space-y-6">
      <div className="text-blue-500">Selected Structure for the Jobpack</div>
      <div className="border rounded-md p-4">
        <table className="w-full mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">Title</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Field</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-blue-100">
              <td className="p-2">BYDP-C</td>
              <td className="p-2">PLATFORM</td>
              <td className="p-2">BAYAN</td>
            </tr>
            <tr>
              <td className="p-2">BYR-A</td>
              <td className="p-2">PLATFORM</td>
              <td className="p-2">BAYAN</td>
            </tr>
            <tr>
              <td className="p-2">SKAPL423</td>
              <td className="p-2">PIPELINE</td>
              <td className="p-2">BAYAN</td>
            </tr>
          </tbody>
        </table>

        <div className="text-blue-500 mb-2">Select the Structure and drag to the top window or click the button ⬆️</div>

        <table className="w-full">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">Title</th>
              <th className="p-2 text-left">Field Name</th>
              <th className="p-2 text-left">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2">12" PC4DPA-B11DRA PC-4</td>
              <td className="p-2">PC-4</td>
              <td className="p-2">12" INCH GAS PC4DP-A TO B11DR-A</td>
            </tr>
            {/* Add more rows as per image */}
          </tbody>
        </table>

        <div className="flex justify-between mt-4">
          <Button variant="outline">Delete</Button>
          <div className="flex gap-2">
            <input type="text" placeholder="Search Structure Title" className="border p-2" />
            <Button>Refresh</Button>
          </div>
        </div>
      </div>
    </div>
  )

  // Step 4: Inspection Selection
  const Step4Content = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <div className="text-blue-500 mb-2">Structure List</div>
          <input type="text" className="border p-2 w-full" defaultValue="BYDP-C" readOnly />
        </div>
        <div>
          <div className="text-blue-500 mb-2">Job Type</div>
          <input type="text" className="border p-2 w-full" defaultValue="Pipeline" readOnly />
        </div>
      </div>

      <div className="text-blue-500">Selected Inspection List for the Job</div>
      <div className="border rounded-md p-4">
        <table className="w-full mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">Inspection Type</th>
              <th className="p-2 text-left">Insp. Code</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-blue-100">
              <td className="p-2">AC Electromagnetic F.C.G.</td>
              <td className="p-2">ACEFC</td>
            </tr>
            <tr>
              <td className="p-2">ACFM Survey</td>
              <td className="p-2">ACFMC</td>
            </tr>
            <tr>
              <td className="p-2">Acoustic Emission</td>
              <td className="p-2">ACUEM</td>
            </tr>
            <tr>
              <td className="p-2">Adhesion Testing</td>
              <td className="p-2">ADHES</td>
            </tr>
            <tr>
              <td className="p-2">Maintenance Task - Anode</td>
              <td className="p-2">ANMAIN</td>
            </tr>
          </tbody>
        </table>

        <div className="text-blue-500 mb-2">Select the Inspections and drag to the top window or click the button ⬆️</div>

        <table className="w-full mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">Insp. Code</th>
              <th className="p-2 text-left">InspectionName</th>
            </tr>
          </thead>
          <tbody>
            {/* Selected inspections will appear here */}
          </tbody>
        </table>

        <div className="flex justify-between">
          <Button variant="outline">Delete</Button>
          <div className="flex gap-2">
            <input type="text" placeholder="Search Inspection Code" className="border p-2" />
            <Button>Refresh</Button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex-1 w-full flex flex-col">
      <div className="flex flex-col items-start">
        <h2 className="font-bold text-2xl">Job Pack</h2>
      </div>

      <div className="container mx-auto py-10">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <div className="border rounded-md p-6 bg-card">
              <Tabs defaultValue="step1" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="step1">Step 1</TabsTrigger>
                  <TabsTrigger value="step2">Step 2</TabsTrigger>
                  <TabsTrigger value="step3">Step 3</TabsTrigger>
                  <TabsTrigger value="step4">Step 4</TabsTrigger>
                </TabsList>
                <TabsContent value="step1">
                  <Step1Content />
                </TabsContent>
                <TabsContent value="step2">
                  <Step2Content />
                </TabsContent>
                <TabsContent value="step3">
                  <Step3Content />
                </TabsContent>
                <TabsContent value="step4">
                  <Step4Content />
                </TabsContent>
              </Tabs>

              <div className="flex justify-between mt-6">
                <Button variant="outline" type="button">
                  Close
                </Button>
                <Button type="submit">
                  Submit
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}