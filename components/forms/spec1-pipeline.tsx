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
          <div className="lg:col-span-8 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 py-4">
                <Info className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-lg">General Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-2">
                <div className="md:col-span-2">
                  <FormFieldWrap label="Title" name="title" form={form} placeholder="Enter pipeline title" />
                </div>
                <div className="md:col-span-2">
                  <FormFieldWrap label="Description" name="pdesc" form={form} placeholder="Detailed pipeline description" />
                </div>
                <FormFieldWrap
                  label="Oil Field"
                  name="pfield"
                  options={libData.data
                    .filter((x: any) => x.lib_code == "OILFIELD")
                    .map((x: any) => ({ label: x.lib_desc, value: x.lib_id }))}
                  form={form}
                  ftype="select"
                />
                <FormFieldWrap
                  label="Inst. Date"
                  name="inst_date"
                  form={form}
                  type="date"
                />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 py-4">
                <Ruler className="h-5 w-5 text-emerald-500" />
                <CardTitle className="text-lg">Technical Parameters</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="Outer Diameter" name="outer_diam" form={form} type="number" />
                  </div>
                  <span className="mb-2 text-sm text-muted-foreground">mm</span>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="Wall Thickness" name="wall_thk" form={form} type="number" />
                  </div>
                  <span className="mb-2 text-sm text-muted-foreground">mm</span>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="Total Length" name="pipe_len" form={form} type="number" />
                  </div>
                  <span className="mb-2 text-sm text-muted-foreground">km</span>
                </div>
                <FormFieldWrap label="Material Type" name="material" form={form} placeholder="e.g. Carbon Steel" />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 py-4">
                <Settings className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-lg">Burial & Protection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-2">
                <FormFieldWrap
                  label="Burial Status"
                  name="burial_stat"
                  form={form}
                  ftype="slider"
                  min={0}
                  max={2}
                  step={0.1}
                />
                <FormFieldWrap label="Protection Method" name="protect_method" form={form} placeholder="e.g. Concrete Coating" />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Location */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 py-4">
                <MapPin className="h-5 w-5 text-red-500" />
                <CardTitle className="text-lg">Location & Path Coordinates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-2">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Point</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <FormFieldWrap label="Northing" name="st_north" form={form} type="number" />
                    <FormFieldWrap label="Easting" name="st_east" form={form} type="number" />
                  </div>
                </div>
                <Separator />
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Point</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <FormFieldWrap label="Northing" name="end_north" form={form} type="number" />
                    <FormFieldWrap label="Easting" name="end_east" form={form} type="number" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-blue-100 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-900/10">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 py-4">
                <Globe className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">System Units</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground italic">
                  Primary unit system for length, weight, and pressure calculations.
                </p>
                <FormFieldWrap label="Unit System" name="def_unit" form={form} placeholder="Metric (SI)" />
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
