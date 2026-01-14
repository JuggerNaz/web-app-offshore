"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { mutate } from "swr";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PipeGeoSchema } from "@/utils/schemas/zod";
import { ColWrap, RowWrap } from "./utils";
import { FormFieldWrap } from "./form-field-wrap";
import { Button } from "../ui/button";
import { Form } from "@/components/ui/form";
import { useEffect } from "react";
import { Save, Globe } from "lucide-react";

export default function Spec2Pipeline() {
  const [pageId, setPageId] = useAtom(urlId);
  const { data, error, isLoading } = useSWR(`/api/pipeline/pipegeo/${pageId}`, fetcher);

  useEffect(() => {
    if (data) form.reset(data?.data);
  }, [data]);

  const form = useForm<z.infer<typeof PipeGeoSchema>>({
    resolver: zodResolver(PipeGeoSchema),
  });

  const onSubmit = async (values: z.infer<typeof PipeGeoSchema>) => {
    if (!data.error && data.data) {
      await fetcher(`/api/pipeline/pipegeo/${values.str_id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      }).then((res) => {
        mutate(`/api/pipeline/pipegeo/${values.str_id}`);
        toast("Pipeline Geodetic Parameter updated successfully");
      });
    } else {
      values.str_id = pageId;
      await fetcher(`/api/pipeline/pipegeo`, {
        method: "POST",
        body: JSON.stringify(values),
      }).then((res) => {
        mutate(`/api/pipeline/pipegeo/${values.str_id}`);
        toast("Pipeline Geodetic Parameter created successfully");
      });
    }
  };

  if (error) return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 animate-in fade-in duration-500">
      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl mb-4 text-red-500">
        <Save className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-black tracking-tight mb-2">Sync Error</h2>
      <p className="text-slate-500 max-w-xs mx-auto mb-6">Failed to synchronize geodetic parameters. Please refresh the connection.</p>
      <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl px-8 font-bold">Retry Connection</Button>
    </div>
  );

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4 animate-in fade-in">
      <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Geodetic Data...</p>
    </div>
  );

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <Card className="rounded-[2.5rem] border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b p-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Globe className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black uppercase tracking-tight">Geodetic Parameters</CardTitle>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Global Positioning & Survey Reference</p>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="rounded-xl h-12 px-8 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 transition-all gap-2"
                >
                  <Save className="h-4 w-4" />
                  Save Geodetic Data
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-10">
                {/* Project & Info */}
                <div className="space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600/80 mb-2">Project Identity</h3>
                  <FormFieldWrap
                    label="Project Name"
                    name="geo_proj_nam"
                    form={form}
                    placeholder="Enter project/survey name"
                  />
                  <FormFieldWrap
                    label="Unit of Measurement"
                    name="geo_units"
                    form={form}
                    placeholder="e.g. Metric"
                  />
                </div>

                {/* Reference System */}
                <div className="space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600/80 mb-2">Reference System</h3>
                  <FormFieldWrap label="Geodetic Datum" name="geo_datum" form={form} placeholder="e.g. WGS84" />
                  <FormFieldWrap
                    label="Ellipsoid / Spheroid"
                    name="geo_elli_sph"
                    form={form}
                    placeholder="e.g. GRS80"
                  />
                  <FormFieldWrap label="Datum Shift Direction" name="geo_dir" form={form} placeholder="e.g. 7-Parameter" />
                </div>

                {/* Translation Parameters */}
                <div className="space-y-6">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600/80 mb-2">Translation (m)</h3>
                  <div className="grid grid-cols-1 gap-6 bg-slate-50/50 dark:bg-slate-900/30 p-6 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <FormFieldWrap
                      label="Shift Dx"
                      name="geo_dx"
                      form={form}
                      placeholder="0.000"
                    />
                    <FormFieldWrap
                      label="Shift Dy"
                      name="geo_dy"
                      form={form}
                      placeholder="0.000"
                    />
                    <FormFieldWrap
                      label="Shift Dz"
                      name="geo_dz"
                      form={form}
                      placeholder="0.000"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
