"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { PipelineSchema } from "@/utils/schemas/zod";
import { FormFieldWrap } from "./form-field-wrap";
import { fetcher } from "@/utils/utils";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Save, Info, Settings, MapPin, Ruler, Layers, Package, Globe, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type Props = {
  data?: any; //TODO: use real type rather than any
};

export default function Spec1Pipeline({ data }: Props) {
  const router = useRouter();

  const {
    data: libData,
    error: libError,
    isLoading: libLoading,
  } = useSWR(`/api/library/${"OILFIELD"}`, fetcher);

  const normalizeDate = (value: string | null | undefined) => {
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  };

  const initialData = data
    ? { ...data, inst_date: normalizeDate((data as any).inst_date) }
    : data;

  const form = useForm<z.infer<typeof PipelineSchema>>({
    resolver: zodResolver(PipelineSchema),
    defaultValues: initialData,
  });

  const onSubmit = async (values: z.infer<typeof PipelineSchema>) => {
    if (values.pipe_id === 0) {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        body: JSON.stringify(values),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("Pipeline created");
        mutate(`/api/pipeline/${values.pipe_id}`);
        router.push(`/dashboard/field/pipeline/${data.data.pipe_id}`);
      } else {
        toast.error("Failed to create pipeline");
      }
    } else {
      const res = await fetch(`/api/pipeline/${values.pipe_id}`, {
        method: "PUT",
        body: JSON.stringify(values),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        toast.success("Pipeline updated");
        mutate(`/api/pipeline/${values.pipe_id}`);
      } else {
        toast.error("Failed to update pipeline");
      }
    }
  };

  if (libError) return <div>failed to load library data</div>;
  if (libLoading) return <div>loading...</div>;

  return (
    <Form {...form}>
      <form
        id="asset-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-10 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 py-4">
                <Info className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-lg">General Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-2">
                <FormFieldWrap label="Pipeline" name="title" form={form} placeholder="Enter pipeline title" />
                <FormFieldWrap label="Description" name="pdesc" form={form} placeholder="Detailed pipeline description" />
                
                <FormFieldWrap
                  label="Oil Field"
                  name="pfield"
                  options={libData.data
                    .filter((x: any) => x.lib_code == "OILFIELD")
                    .map((x: any) => ({ label: x.lib_desc, value: x.lib_id }))}
                  form={form}
                  ftype="select"
                />
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="Depth" name="depth" form={form} type="number" />
                  </div>
                  <span className="mb-2 text-sm text-cyan-600">m</span>
                </div>

                <FormFieldWrap label="Medium" name="ptype" form={form} placeholder="Medium" />
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="Design Life" name="desg_life" form={form} type="number" />
                  </div>
                  <span className="mb-2 text-sm text-cyan-600">year</span>
                </div>

                <FormFieldWrap
                  label="Inst. Date"
                  name="inst_date"
                  form={form}
                  type="date"
                />
                <FormFieldWrap label="Process" name="process" form={form} placeholder="Process" />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 py-4">
                <MapPin className="h-5 w-5 text-red-500" />
                <CardTitle className="text-lg">Location & Path Coordinates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-2">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Starts At</h4>
                  <div className="grid grid-cols-4 gap-3">
                    <FormFieldWrap label="Location" name="st_loc" form={form} />
                    <div className="flex items-end gap-1">
                      <div className="flex-1">
                        <FormFieldWrap label="KP" name="st_fp" form={form} type="number" />
                      </div>
                      <span className="mb-2 text-xs text-cyan-600">km</span>
                    </div>
                    <div className="flex items-end gap-1">
                      <div className="flex-1">
                        <FormFieldWrap label="Easting" name="st_x" form={form} />
                      </div>
                      <span className="mb-2 text-xs text-cyan-600">m</span>
                    </div>
                    <div className="flex items-end gap-1">
                      <div className="flex-1">
                        <FormFieldWrap label="Northing" name="st_y" form={form} />
                      </div>
                      <span className="mb-2 text-xs text-cyan-600">m</span>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ends At</h4>
                  <div className="grid grid-cols-4 gap-3">
                    <FormFieldWrap label="Location" name="end_loc" form={form} />
                    <div className="flex items-end gap-1">
                      <div className="flex-1">
                        <FormFieldWrap label="KP" name="end_fp" form={form} type="number" />
                      </div>
                      <span className="mb-2 text-xs text-cyan-600">km</span>
                    </div>
                    <div className="flex items-end gap-1">
                      <div className="flex-1">
                        <FormFieldWrap label="Easting" name="end_x" form={form} />
                      </div>
                      <span className="mb-2 text-xs text-cyan-600">m</span>
                    </div>
                    <div className="flex items-end gap-1">
                      <div className="flex-1">
                        <FormFieldWrap label="Northing" name="end_y" form={form} />
                      </div>
                      <span className="mb-2 text-xs text-cyan-600">m</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 py-4">
                <Ruler className="h-5 w-5 text-emerald-500" />
                <CardTitle className="text-lg">Technical Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-x-6 gap-y-4">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <FormFieldWrap label="Length" name="plength" form={form} type="number" />
                    </div>
                    <span className="mb-2 text-sm text-cyan-600">km</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <FormFieldWrap label="Diameter" name="line_diam" form={form} type="number" />
                    </div>
                    <span className="mb-2 text-sm text-cyan-600">mm</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <FormFieldWrap label="Wall Thkns." name="wall_thk" form={form} type="number" />
                    </div>
                    <span className="mb-2 text-sm text-cyan-600">mm</span>
                  </div>
                  <FormFieldWrap label="Material" name="material" form={form} placeholder="e.g. API 5L G X65" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                  <FormFieldWrap label="Cp System" name="cp_system" form={form} placeholder="e.g. SACRIFICIAL" />
                  <FormFieldWrap label="Corrosion Coating" name="corr_ctg" form={form} placeholder="e.g. ASPHALT+3CPP" />
                  <div className="flex items-end gap-2">
                    <div className="flex-[2]">
                      <FormFieldWrap label="Concrete Coating" name="conc_ctg" form={form} placeholder="e.g. 3044KG/M3" />
                    </div>
                    <div className="flex-1 flex items-end gap-1">
                      <FormFieldWrap label="%" name="conc_ctg_per" form={form} type="number" />
                      <span className="mb-2 text-sm text-white">%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 py-4">
                <Activity className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-lg">Operational Parameters</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 pt-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="Design Pressure" name="desg_press" form={form} type="number" />
                  </div>
                  <span className="mb-2 text-sm text-cyan-600">bars</span>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="Operating Pressure" name="oper_press" form={form} type="number" />
                  </div>
                  <span className="mb-2 text-sm text-cyan-600">bars</span>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="Line Burried" name="burial" form={form} type="number" />
                  </div>
                  <span className="mb-2 text-sm text-white">%</span>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="Constructional Span" name="span_cons" form={form} type="number" />
                  </div>
                  <span className="mb-2 text-sm text-cyan-600">m</span>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="Operational Span" name="span_oper" form={form} type="number" />
                  </div>
                  <span className="mb-2 text-sm text-cyan-600">m</span>
                </div>
                <FormFieldWrap label="Installation Contractor" name="inst_ctr" form={form} placeholder="N/A" />
              </CardContent>
            </Card>

          </div>

          {/* Right Column - Misc & Unit */}
          <div className="lg:col-span-2 space-y-6">

            <Card className="shadow-sm border-blue-100 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-900/10">
              <CardHeader className="flex flex-row items-center gap-1 space-y-0 py-2 px-3">
                <Globe className="h-3.5 w-3.5 text-blue-600" />
                <CardTitle className="text-[10px] uppercase font-bold tracking-tight">Units</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0 px-3 pb-3">
                <p className="text-[9px] leading-tight text-muted-foreground">
                  Default measurement system.
                </p>
                <FormFieldWrap label="" name="def_unit" form={form} placeholder="METRIC" />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-1 space-y-0 py-2 px-3">
                <Layers className="h-3.5 w-3.5 text-indigo-500" />
                <CardTitle className="text-[10px] uppercase font-bold tracking-tight">Finalize</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-3 pb-3">
                <Button type="submit" className="w-full h-9 text-xs font-bold px-2">
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Save
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Floating Mobile Submit Area */}
        <div className="fixed bottom-6 right-6 lg:hidden z-50">
          <Button type="submit" size="lg" className="rounded-full h-14 w-14 shadow-2xl">
            <Save className="h-6 w-6" />
          </Button>
        </div>
      </form>
    </Form>
  );
}
