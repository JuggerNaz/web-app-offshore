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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { getUnitOptions, getDefaultUnit } from "@/utils/unit-helpers";
import { useEffect, useState } from "react";

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

  const {
    data: settingsData,
    error: settingsError,
    isLoading: settingsLoading,
  } = useSWR("/api/company-settings", fetcher);

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

  const defUnit = form.watch("def_unit") || settingsData?.data?.def_unit || "METRIC";
  const isImperial = defUnit === "IMPERIAL";

  // Sync the form's def_unit field with company settings if not already set (e.g. for new assets)
  useEffect(() => {
    if (!settingsLoading && settingsData?.data) {
      const currentVal = form.getValues("def_unit");
      if (!currentVal) {
        form.setValue("def_unit", settingsData.data.def_unit || "METRIC");
      }
    }
  }, [settingsData, settingsLoading, form]);

  // Transient unit state
  const [units, setUnits] = useState({
    depth: "m",
    desg_life: "years",
    st_fp: "km",
    st_x: "m",
    st_y: "m",
    end_fp: "km",
    end_x: "m",
    end_y: "m",
    plength: "km",
    line_diam: "mm",

    conc_ctg_per: "%",
    desg_press: "bar",
    oper_press: "bar",
    burial: "%",
    span_cons: "m",
    span_oper: "m"
  });

  useEffect(() => {
    if (!settingsLoading && settingsData?.data) {
      setUnits({
        depth: getDefaultUnit("LENGTH", isImperial, "depth") || "m",
        desg_life: getDefaultUnit("TIME", isImperial) || "years",
        st_fp: getDefaultUnit("DISTANCE", isImperial, "st_fp") || "km",
        st_x: getDefaultUnit("LENGTH", isImperial, "st_x") || "m",
        st_y: getDefaultUnit("LENGTH", isImperial, "st_y") || "m",
        end_fp: getDefaultUnit("DISTANCE", isImperial, "end_fp") || "km",
        end_x: getDefaultUnit("LENGTH", isImperial, "end_x") || "m",
        end_y: getDefaultUnit("LENGTH", isImperial, "end_y") || "m",
        plength: getDefaultUnit("DISTANCE", isImperial, "plength") || "km",
        line_diam: getDefaultUnit("LENGTH", isImperial, "line_diam") || "mm",

        conc_ctg_per: getDefaultUnit("PERCENT", isImperial) || "%",
        desg_press: getDefaultUnit("PRESSURE", isImperial) || "bar",
        oper_press: getDefaultUnit("PRESSURE", isImperial) || "bar",
        burial: getDefaultUnit("PERCENT", isImperial) || "%",
        span_cons: getDefaultUnit("LENGTH", isImperial, "span_cons") || "m",
        span_oper: getDefaultUnit("LENGTH", isImperial, "span_oper") || "m"
      });
    }
  }, [isImperial, settingsLoading, settingsData]);

  const renderUnitSelect = (fieldName: keyof typeof units, category: string) => {
    if (category.toUpperCase() === "PERCENT") {
      return <span className="mb-2 text-[10px] text-muted-foreground font-black lowercase">{units[fieldName]}</span>;
    }
    const options = getUnitOptions(category, isImperial);
    if (!options || options.length === 0) return <span className="mb-2 text-[10px] text-muted-foreground font-black lowercase">{units[fieldName]}</span>;

    return (
      <div className="mb-1.5 min-w-[50px]">
        <Select 
          value={units[fieldName]} 
          onValueChange={(val) => setUnits(prev => ({ ...prev, [fieldName]: val }))}
        >
          <SelectTrigger className="h-7 border-none bg-slate-100/50 dark:bg-slate-900/50 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors text-[10px] font-black tracking-tighter rounded-lg px-2 shadow-none focus:ring-0 text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between w-full gap-1">
              <span className="truncate">{units[fieldName] || options[0]}</span>
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
            {options.map((opt) => (
              <SelectItem key={opt} value={opt} className="text-[10px] font-bold">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

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

  if (libError || settingsError) return <div>failed to load library data</div>;
  if (libLoading || settingsLoading) return <div>loading...</div>;

  return (
    <Form {...form}>
      <form
        id="asset-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-12 space-y-6">
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
                  {renderUnitSelect("depth", "LENGTH")}
                </div>

                <FormFieldWrap label="Medium" name="ptype" form={form} placeholder="Medium" />
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="Design Life" name="desg_life" form={form} type="number" />
                  </div>
                  {renderUnitSelect("desg_life", "TIME")}
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
                      {renderUnitSelect("st_fp", "DISTANCE")}
                    </div>
                    <div className="flex items-end gap-1">
                      <div className="flex-1">
                        <FormFieldWrap label="Easting" name="st_x" form={form} />
                      </div>
                      {renderUnitSelect("st_x", "LENGTH")}
                    </div>
                    <div className="flex items-end gap-1">
                      <div className="flex-1">
                        <FormFieldWrap label="Northing" name="st_y" form={form} />
                      </div>
                      {renderUnitSelect("st_y", "LENGTH")}
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
                      {renderUnitSelect("end_fp", "DISTANCE")}
                    </div>
                    <div className="flex items-end gap-1">
                      <div className="flex-1">
                        <FormFieldWrap label="Easting" name="end_x" form={form} />
                      </div>
                      {renderUnitSelect("end_x", "LENGTH")}
                    </div>
                    <div className="flex items-end gap-1">
                      <div className="flex-1">
                        <FormFieldWrap label="Northing" name="end_y" form={form} />
                      </div>
                      {renderUnitSelect("end_y", "LENGTH")}
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <FormFieldWrap label="Length" name="plength" form={form} type="number" />
                    </div>
                    {renderUnitSelect("plength", "DISTANCE")}
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <FormFieldWrap label="Diameter" name="line_diam" form={form} type="number" />
                    </div>
                    {renderUnitSelect("line_diam", "LENGTH")}
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
                      <div className="flex-1">
                        <FormFieldWrap label="%" name="conc_ctg_per" form={form} type="number" />
                      </div>
                      {renderUnitSelect("conc_ctg_per", "PERCENT")}
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
                  {renderUnitSelect("desg_press", "PRESSURE")}
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="Operating Pressure" name="oper_press" form={form} type="number" />
                  </div>
                  {renderUnitSelect("oper_press", "PRESSURE")}
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="Line Burried" name="burial" form={form} type="number" />
                  </div>
                  {renderUnitSelect("burial", "PERCENT")}
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="Constructional Span" name="span_cons" form={form} type="number" />
                  </div>
                  {renderUnitSelect("span_cons", "LENGTH")}
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormFieldWrap label="Operational Span" name="span_oper" form={form} type="number" />
                  </div>
                  {renderUnitSelect("span_oper", "LENGTH")}
                </div>
                <FormFieldWrap label="Installation Contractor" name="inst_ctr" form={form} placeholder="N/A" />
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
