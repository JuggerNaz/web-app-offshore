"use client";
import { useState, useEffect, use } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { JobpackSchema } from "@/utils/schemas/zod";
import { useAtom } from "jotai";
import { urlInspNo } from "@/utils/client-state";
import { useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { FormFieldWrap } from "@/components/forms/form-field-wrap";
import { ColWrap, RowWrap } from "@/components/forms/utils";
import { DataTable } from "@/components/data-table/data-table";
import { structure, extendStructureColumn } from "@/components/data-table/columns";
import { toast } from "sonner";

export default function JobPackPage() {
  const { id } = useParams();
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState(`step-${step}`);
  const [formData, setFormData] = useState<Partial<z.infer<typeof JobpackSchema>>>({});
  const [inspNo, setInspNo] = useAtom(urlInspNo);

  const { data, error, isLoading } = useSWR(`/api/jobpack/${id}`, fetcher);
  const {
    data: libData,
    error: libDataError,
    isLoading: libDataLoading,
  } = useSWR(`/api/library/${"DIVETYP"}`, fetcher);
  const {
    data: structures,
    error: structuresError,
    isLoading: structuresLoading,
  } = useSWR(`/api/structure`, fetcher);
  const {
    data: taskstr,
    error: taskstrError,
    isLoading: taskstrLoading,
  } = useSWR(`/api/taskstr/${id}`, fetcher);

  const [selectedStructures, setSelectedStructures] = useState<number>(0);
  const [structureList, setStructureList] = useState<any[]>([]);
  const [selectedStructuresList, setSelectedStructuresList] = useState<any[]>([]);
  const [removeSelectedStructure, setRemoveSelectedStructure] = useState<number>(0);

  useEffect(() => {
    if (data) form.reset(data?.data);
  }, [data]);

  useEffect(() => {
    if (structures && taskstr) {
      // Extract the IDs of structures that are already in taskstr
      const taskstrIds = taskstr.data.map((item: any) => item.str_id);

      // Separate structures into selectedStructuresList and structureList
      const selected = structures.data.filter((item: any) => taskstrIds.includes(item.str_id));
      const remaining = structures.data.filter((item: any) => !taskstrIds.includes(item.str_id));

      setSelectedStructuresList(
        selected.map((item: any) => ({
          str_id: item.str_id,
          str_title: item.str_title,
          str_field: item.str_field,
          str_type: item.str_type,
        }))
      );

      setStructureList(remaining);
    }
  }, [structures, taskstr]);

  useEffect(() => {
    if (selectedStructures > 0) {
      setSelectedStructuresList(
        selectedStructuresList.concat(
          structures.data.filter((item: any) => item.str_id === selectedStructures)
        )
      );
      setStructureList(structureList.filter((item: any) => item.str_id !== selectedStructures));
    }
  }, [selectedStructures]);

  // useEffect(() => {
  //   if(selectedStructuresList.length > 0) {
  //     console.log('Selected Structures List:', selectedStructuresList)
  //   }
  // }, [selectedStructuresList])

  useEffect(() => {
    if (removeSelectedStructure > 0) {
      setSelectedStructuresList(
        selectedStructuresList.filter((item: any) => item.str_id !== removeSelectedStructure)
      );
      setStructureList(
        structureList.concat(
          structures.data.filter((item: any) => item.str_id === removeSelectedStructure)
        )
      );
    }
  }, [removeSelectedStructure]);

  useEffect(() => {
    const resolvedInspNo = Array.isArray(id) ? id[0] : id;
    setInspNo(resolvedInspNo || "");
  }, []);

  // Update activeTab when step changes
  useEffect(() => {
    setActiveTab(`step-${step}`);
  }, [step]);

  const handleNext = () => {
    const nextStep = Math.min(step + 1, 5);
    setStep(nextStep);
  };

  const handlePrevious = () => {
    const prevStep = Math.max(step - 1, 1);
    setStep(prevStep);
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    const newStep = parseInt(value.split("-")[1]);
    setStep(newStep);
    setActiveTab(value);
  };

  const form = useForm<z.infer<typeof JobpackSchema>>({
    resolver: zodResolver(JobpackSchema),
  });

  const onSubmit = (values: z.infer<typeof JobpackSchema>) => {
    // setFormData(prev => ({ ...prev, ...data }))
    // console.log('Form data:', data)
    fetcher(`/api/jobpack/${id}`, {
      method: "PUT",
      body: JSON.stringify(values),
    })
      .then((res) => {
        mutate(`/api/jobpack/${id}`); //if want to mutate
        toast(`Job Pack ${id} updated successfully`);
        setStep(1);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to update Job Pack");
      });
  };

  if (error || libDataError || structuresError || taskstrError) return <div>failed to load</div>;
  if (isLoading || libDataLoading || structuresLoading || taskstrLoading)
    return <div>loading...</div>;

  return (
    <div className="flex-1 w-full flex flex-col">
      <div className="flex flex-col items-start">
        <h2 className="font-bold text-2xl">
          Job Pack {`(${id})`} {step > 1 ? `Creation - Step ${step}` : ""}
        </h2>
        <p className="text-muted-foreground">Create and manage inspection job packs</p>
      </div>

      <div className="mt-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="step-1">Initial Selection</TabsTrigger>
                <TabsTrigger value="step-2" disabled={step < 2}>
                  Job Pack Details
                </TabsTrigger>
                <TabsTrigger value="step-3" disabled={step < 3}>
                  Structure Selection
                </TabsTrigger>
                <TabsTrigger value="step-4" disabled={step < 4}>
                  Inspection Types
                </TabsTrigger>
              </TabsList>

              {/* Step 1: Initial Selection */}
              <TabsContent value="step-1" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {
                      <FormField
                        control={form.control}
                        name="tasktype"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field?.value}
                                className="flex flex-col gap-2"
                              >
                                {/* {[
                                    { value: 'STRUCTURE', label: 'Structure' },
                                    { value: 'COMPONENT', label: 'Component' }
                                  ].map((type) => (
                                    <div key={type.value} className="flex items-center space-x-2">
                                      <RadioGroupItem value={type.value} id={type.value} />
                                      <Label htmlFor={type.value}>{type.label}</Label>
                                    </div>
                                  ))} */}
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="STRUCTURE" id="STRUCTURE" />
                                  <Label htmlFor="option-one">Structure</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="COMPONENT" id="option-two" />
                                  <Label htmlFor="option-two">Component</Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    }
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Scope</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RowWrap>
                      <FormFieldWrap
                        label="Topside"
                        name="topside"
                        form={form}
                        placeholder=""
                        ftype="checkbox"
                      />
                      <FormFieldWrap
                        label="Subsea"
                        name="subsea"
                        form={form}
                        placeholder=""
                        ftype="checkbox"
                      />
                    </RowWrap>
                  </CardContent>
                </Card>
                <div className="flex justify-end">
                  <Button onClick={handleNext}>Next</Button>
                </div>
              </TabsContent>
              {/* Step 2: JobPack Details */}
              <TabsContent value="step-2" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Job Pack Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <RowWrap>
                      <div className="flex-col w-2/3 space-y-6">
                        <RowWrap>
                          <ColWrap>
                            <FormFieldWrap
                              label="Job Name"
                              name="jobname"
                              form={form}
                              placeholder="Jobpack Name"
                              ftype="vertical"
                            />
                            <FormFieldWrap
                              label="Start Date"
                              name="istart"
                              form={form}
                              placeholder=""
                              type="datetime-local"
                              ftype="vertical"
                            />
                          </ColWrap>
                          <ColWrap>
                            <FormFieldWrap
                              label="Plan Type"
                              name="plantype"
                              form={form}
                              placeholder=""
                              ftype="vertical"
                            />
                            <FormFieldWrap
                              label="End Date"
                              name="iend"
                              form={form}
                              placeholder=""
                              type="datetime-local"
                              ftype="vertical"
                            />
                          </ColWrap>
                        </RowWrap>
                        <RowWrap>
                          <ColWrap>
                            <FormFieldWrap
                              label="Contractor"
                              name="contrac"
                              form={form}
                              placeholder=""
                              ftype="vertical"
                            />
                            <FormFieldWrap
                              label="Company Rep"
                              name="comprep"
                              form={form}
                              placeholder=""
                              ftype="vertical"
                            />
                          </ColWrap>
                        </RowWrap>
                        <RowWrap>
                          <ColWrap>
                            <FormFieldWrap
                              label="Vessel"
                              name="vesel"
                              form={form}
                              placeholder=""
                              ftype="vertical"
                            />
                          </ColWrap>
                          <ColWrap>
                            <FormFieldWrap
                              label="Dive Type"
                              name="divetyp"
                              options={libData.data
                                .filter((x: any) => x.lib_code == "DIVETYP")
                                .map((x: any) => {
                                  return { label: x.lib_desc, value: x.lib_id };
                                })}
                              form={form}
                              ftype="vselect"
                            />
                          </ColWrap>
                        </RowWrap>
                        <RowWrap>
                          <ColWrap>
                            <FormFieldWrap
                              label="Contract Ref#"
                              name="contract_ref"
                              form={form}
                              placeholder=""
                              ftype="vertical"
                            />
                          </ColWrap>
                          <ColWrap>
                            <FormFieldWrap
                              label="Contractor Ref#"
                              name="contractor_ref"
                              form={form}
                              placeholder=""
                              ftype="vertical"
                            />
                          </ColWrap>
                        </RowWrap>
                        <RowWrap>
                          <ColWrap>
                            <FormFieldWrap
                              label="Estimated Time"
                              name="site_hrs"
                              form={form}
                              placeholder=""
                              ftype="vertical"
                            />
                          </ColWrap>
                          <ColWrap>
                            <FormFieldWrap
                              label="Status"
                              name="status"
                              options={[
                                { label: "OPEN", value: "OPEN" },
                                { label: "CLOSED", value: "CLOSED" },
                              ]}
                              form={form}
                              ftype="vselect"
                            />
                          </ColWrap>
                        </RowWrap>
                      </div>
                      <div className="flex-col w-1/3">
                        <div className="border rounded-md p-4 mb-4">
                          <div className="text-center mb-4">Contractor Logo:</div>
                          <div className="w-32 h-32 mx-auto border flex items-center justify-center">
                            <Button variant="outline" size="sm">
                              Upload
                            </Button>
                          </div>
                        </div>
                        <div className="border rounded-md p-4">
                          <div className="mb-2 font-medium">Contractor Address:</div>
                          <div className="text-sm text-muted-foreground">
                            ALAM MARITIM (M) SDN BHD
                            <br />
                            No. 38F, Level 3, Jalan Radin Anum,
                            <br />
                            Bandar Baru Sri Petaling,
                            <br />
                            57000 Kuala Lumpur
                          </div>
                        </div>
                      </div>
                    </RowWrap>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="comments">Comments</Label>
                          <textarea
                            id="comments"
                            className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                      <div></div>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={handlePrevious}>
                    Previous
                  </Button>
                  <Button onClick={handleNext}>Next</Button>
                </div>
              </TabsContent>
              {/* Step 3: Structure Selection */}
              <TabsContent value="step-3" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Selected Structure List</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DataTable
                      columns={extendStructureColumn({
                        setValue: setRemoveSelectedStructure,
                        isRemove: true,
                      })}
                      data={selectedStructuresList}
                    />
                    <p className="text-sm text-muted-foreground my-4">
                      Select the Structure and click to add to the list above
                    </p>
                    <DataTable
                      columns={extendStructureColumn({ setValue: setSelectedStructures })}
                      data={structureList}
                    />
                  </CardContent>
                </Card>
                <div className="flex justify-between">
                  <Button variant="outline" onClick={handlePrevious}>
                    Previous
                  </Button>
                  <Button type="button" onClick={handleNext}>
                    Next
                  </Button>
                </div>
              </TabsContent>
              {/* Step 4: Inspection Types */}
              <TabsContent value="step-4" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Inspection Types</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-md mb-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Inspection Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Scope</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell>GVI</TableCell>
                            <TableCell>General Visual Inspection</TableCell>
                            <TableCell>SUBSEA</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm">
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell>CVI</TableCell>
                            <TableCell>Close Visual Inspection</TableCell>
                            <TableCell>SUBSEA</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm">
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Select inspection types to add to the job pack
                    </p>
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Inspection Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Scope</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow className="cursor-pointer hover:bg-muted">
                            <TableCell>FMD</TableCell>
                            <TableCell>Flooded Member Detection</TableCell>
                            <TableCell>SUBSEA</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm">
                                Add
                              </Button>
                            </TableCell>
                          </TableRow>
                          <TableRow className="cursor-pointer hover:bg-muted">
                            <TableCell>CP</TableCell>
                            <TableCell>Cathodic Protection</TableCell>
                            <TableCell>SUBSEA</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm">
                                Add
                              </Button>
                            </TableCell>
                          </TableRow>
                          <TableRow className="cursor-pointer hover:bg-muted">
                            <TableCell>UT</TableCell>
                            <TableCell>Ultrasonic Testing</TableCell>
                            <TableCell>SUBSEA</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm">
                                Add
                              </Button>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Job Pack Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="border rounded-md p-3">
                        <h4 className="font-medium mb-2">Job Pack Details</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          <li>Job Name: UIMC2022/SKA/PIPE1</li>
                          <li>Contractor: ALAM MARITIM (M) SDN BHD</li>
                          <li>Vessel: MV PIONEER</li>
                          <li>Start Date: 03-MAR-2022</li>
                        </ul>
                      </div>
                      <div className="border rounded-md p-3">
                        <h4 className="font-medium mb-2">Selected Structures</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          <li>BNDP-A (PLATFORM, BARONIA)</li>
                          <li>TKT-H (PLATFORM, TUKAU)</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={handlePrevious}>
                    Previous
                  </Button>
                  <Button type="submit">Finish</Button>
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </Form>
      </div>
    </div>
  );
}
