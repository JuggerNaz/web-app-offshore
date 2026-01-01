"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { PlatformSchema } from "@/utils/schemas/zod";
import { FormFieldWrap } from "./form-field-wrap";
import { fetcher } from "@/utils/utils";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Save, Info, Settings, MapPin, Ruler, Layers, Package, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type Props = {
  data?: any; //TODO: use real type rather than any
};

export default function Spec1({ data }: Props) {
  const router = useRouter();

  const normalizeDate = (value: string | null | undefined) => {
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  };

  const initialData = data
    ? { ...data, inst_date: normalizeDate((data as any).inst_date) }
    : data;

  const {
    data: libData,
    error,
    isLoading,
  } = useSWR(`/api/library/${"PLAT_TYP,PLAT_FUNCT,PLAT_MAT,PLAT_CP,CORR_CTG,PLAT_CONT,OILFIELD"}`, fetcher);

  const form = useForm<z.infer<typeof PlatformSchema>>({
    resolver: zodResolver(PlatformSchema),
    defaultValues: initialData,
  });

  const legsCountRaw = form.watch("plegs");
  const legsCount = Number(legsCountRaw) || 0;
  const isLegDisabled = (legNumber: number) => legNumber > legsCount;

  const onSubmit = async (values: z.infer<typeof PlatformSchema>) => {
    if (values.plat_id == 0) {
      const res = await fetch(`/api/platform`, {
        method: "POST",
        body: JSON.stringify(values),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("Platform created");
        mutate(`/api/platform/${values.plat_id}`);
        router.push(`/dashboard/field/platform/${data.data.plat_id}`);
      } else {
        toast.error("Failed to create platform");
      }
    } else {
      const res = await fetch(`/api/platform/${values.plat_id}`, {
        method: "PUT",
        body: JSON.stringify(values),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        toast.success("Platform updated");
        mutate(`/api/platform/${values.plat_id}`);
      } else {
        toast.error("Failed to update platform");
      }
    }
  };

  if (error) return <div>failed to load</div>;
  if (isLoading) return <div>loading...</div>;

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
            {/* General Information */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 py-4">
                <Info className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-lg">General Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-2">
                <div className="md:col-span-2">
                  <FormFieldWrap label="Title" name="title" form={form} placeholder="Enter platform title" />
                </div>
                <div className="md:col-span-2">
                  <FormFieldWrap label="Description" name="pdesc" form={form} placeholder="Detailed platform description" />
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
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="Depth" name="depth" form={form} placeholder="0" type="number" />
                  </div>
                  <span className="mb-2 text-sm text-muted-foreground font-medium">m</span>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="Design Life" name="desg_life" form={form} placeholder="0" type="number" />
                  </div>
                  <span className="mb-2 text-sm text-muted-foreground font-medium">years</span>
                </div>
              </CardContent>
            </Card>

            {/* Classification & Configuration */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 py-4">
                <Settings className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-lg">Configuration</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-2">
                <FormFieldWrap
                  label="Type"
                  name="ptype"
                  options={libData.data
                    .filter((x: any) => x.lib_code == "PLAT_TYP")
                    .map((x: any) => ({ label: x.lib_desc, value: x.lib_id }))}
                  form={form}
                  ftype="select"
                />
                <FormFieldWrap
                  label="Function"
                  name="process"
                  options={libData.data
                    .filter((x: any) => x.lib_code == "PLAT_FUNCT")
                    .map((x: any) => ({ label: x.lib_desc, value: x.lib_id }))}
                  form={form}
                  ftype="select"
                />
                <FormFieldWrap
                  label="Material"
                  name="material"
                  options={libData.data
                    .filter((x: any) => x.lib_code == "PLAT_MAT")
                    .map((x: any) => ({ label: x.lib_desc, value: x.lib_id }))}
                  form={form}
                  ftype="select"
                />
                <FormFieldWrap
                  label="CP System"
                  name="cp_system"
                  options={libData.data
                    .filter((x: any) => x.lib_code == "PLAT_CP")
                    .map((x: any) => ({ label: x.lib_desc, value: x.lib_id }))}
                  form={form}
                  ftype="select"
                />
                <FormFieldWrap
                  label="Corrosion Coating"
                  name="corr_ctg"
                  options={libData.data
                    .filter((x: any) => x.lib_code == "CORR_CTG")
                    .map((x: any) => ({ label: x.lib_desc, value: x.lib_id }))}
                  form={form}
                  ftype="select"
                />
                <FormFieldWrap
                  label="Installation Contractor"
                  name="inst_ctr"
                  options={libData.data
                    .filter((x: any) => x.lib_code == "PLAT_CONT")
                    .map((x: any) => ({ label: x.lib_desc, value: x.lib_id }))}
                  form={form}
                  ftype="select"
                />
              </CardContent>
            </Card>

            {/* Inventory & Counts */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row justify-between items-center py-4">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-purple-500" />
                  <CardTitle className="text-lg">Inventory Statistics</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-2">
                <FormFieldWrap label="Conductors" name="conduct" form={form} ftype="vertical" type="number" />
                <FormFieldWrap label="Internal Piles" name="pileint" form={form} ftype="vertical" type="number" />
                <FormFieldWrap label="Slots" name="cslota" form={form} ftype="vertical" type="number" />
                <FormFieldWrap label="Fenders" name="fender" form={form} ftype="vertical" type="number" />
                <FormFieldWrap label="Risers" name="riser" form={form} ftype="vertical" type="number" />
                <FormFieldWrap label="Sumps" name="sump" form={form} ftype="vertical" type="number" />
                <FormFieldWrap label="Skirt Piles" name="pileskt" form={form} ftype="vertical" type="number" />
                <FormFieldWrap label="Caissons" name="caisson" form={form} ftype="vertical" type="number" />
                <FormFieldWrap label="Anodes" name="an_qty" form={form} ftype="vertical" type="number" />
                <FormFieldWrap label="Cranes" name="crane" form={form} ftype="vertical" type="number" />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Logistics & Metadata */}
          <div className="lg:col-span-4 space-y-6">
            {/* Location & Orientation */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 py-4">
                <MapPin className="h-5 w-5 text-red-500" />
                <CardTitle className="text-lg">Location & Coordinates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <FormFieldWrap label="Northing" name="st_north" form={form} type="number" />
                    </div>
                    <span className="mb-2 text-xs text-muted-foreground">m</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <FormFieldWrap label="Easting" name="st_east" form={form} type="number" />
                    </div>
                    <span className="mb-2 text-xs text-muted-foreground">m</span>
                  </div>
                </div>
                <Separator className="my-2" />
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="True North Angle" name="north_angle" form={form} type="number" />
                  </div>
                  <span className="mb-2 text-xs text-muted-foreground font-medium">Deg.</span>
                </div>
                <FormFieldWrap label="Platform North Side" name="north_side" form={form} placeholder="N/A" />
              </CardContent>
            </Card>

            {/* Dimensions & Status */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 py-4 border-b">
                <Ruler className="h-5 w-5 text-emerald-500" />
                <CardTitle className="text-lg">Dimensions & Status</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-2">
                  <div className="p-4 border-r border-b">
                    <FormFieldWrap label="Max Leg Dia." name="dleg" form={form} type="number" />
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Unit: mm</span>
                  </div>
                  <div className="p-4 border-b">
                    <FormFieldWrap label="Max Wall Thk." name="wall_thk" form={form} type="number" />
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Unit: mm</span>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                  <FormFieldWrap label="Helipad?" name="helipad" form={form} ftype="checkbox" />
                  <FormFieldWrap label="Manned?" name="manned" form={form} ftype="checkbox" />
                </div>
              </CardContent>
            </Card>

            {/* Units & Settings */}
            <Card className="shadow-sm border-blue-100 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-900/10">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 py-4">
                <Globe className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Reporting Units</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-2">
                <p className="text-xs text-muted-foreground italic">
                  Defines the default measurement system for this platform and all its associated components and inspections.
                </p>
                <FormFieldWrap label="Unit System" name="def_unit" form={form} placeholder="e.g. SI / Metric" />
              </CardContent>
            </Card>
          </div>

          {/* Leg Management - Full Width Bottom Section */}
          <div className="lg:col-span-12">
            <Card className="shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-indigo-500" />
                    <CardTitle className="text-lg">Platform Legs Configuration</CardTitle>
                  </div>
                  <div className="flex items-center gap-4">
                    <Label className="text-xs font-semibold uppercase text-muted-foreground">Total Active Legs:</Label>
                    <div className="w-20">
                      <FormFieldWrap label="" name="plegs" form={form} ftype="normal" type="number" />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-x-4 gap-y-6">
                  {Array.from({ length: 20 }).map((_, i) => {
                    const legNum = i + 1;
                    return (
                      <div key={legNum} className={`transition-opacity duration-200 ${isLegDisabled(legNum) ? 'opacity-30' : 'opacity-100'}`}>
                        <FormFieldWrap
                          label={`Leg ${legNum}`}
                          name={`leg_t${legNum}`}
                          form={form}
                          ftype="normal"
                          disabled={isLegDisabled(legNum)}
                          formControlClass="h-9 px-2 text-center font-bold"
                          placeholder="ID"
                        />
                      </div>
                    );
                  })}
                </div>
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
