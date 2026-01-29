"use client";
import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  ChevronLeft,
  Package,
  ShieldCheck,
  Search,
  Plus,
  Trash2,
  Activity,
  Zap,
  Layers2,
  Navigation,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter, useSearchParams, useParams, usePathname } from "next/navigation";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { JobpackSchema } from "@/utils/schemas/zod";
import { FormFieldWrap } from "@/components/forms/form-field-wrap";
import moment from "moment";

type JobpackValues = z.infer<typeof JobpackSchema>;

export default function JobpackForm({ id: propId }: { id?: string }) {
  const params = useParams();
  const pathname = usePathname();

  const rawId = propId || params?.id as string;
  const isNew = rawId === "new" || pathname.endsWith("/new");
  const id = isNew ? null : rawId;

  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectionSearch, setInspectionSearch] = useState("");
  const [selectedStructures, setSelectedStructures] = useState<any[]>([]);
  const [selectedInspections, setSelectedInspections] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading } = useSWR(id ? `/api/jobpack/${id}` : null, fetcher);
  const { data: platforms } = useSWR("/api/platform", fetcher);
  const { data: pipelines } = useSWR("/api/pipeline", fetcher);
  const { data: inspectionTypes } = useSWR("/api/inspection-type", fetcher);

  const form = useForm<JobpackValues>({
    resolver: zodResolver(JobpackSchema),
    defaultValues: {
      name: "",
      status: "OPEN",
      tasktype: "STRUCTURE",
      plantype: "INSTANT",
      divetyp: "ROV",
      topside: 0,
      subsea: 0,
      istart: "",
      iend: "",
      contrac: "",
      comprep: "",
      vessel: "",
      contract_ref: "",
      contractor_ref: "",
      site_hrs: 0,
    },
  });

  useEffect(() => {
    if (data?.data) {
      const jobpack = data.data;
      const metadata = jobpack.metadata || {};
      form.reset({
        ...jobpack,
        ...metadata,
        name: jobpack.name || "",
        status: jobpack.status || "OPEN",
        tasktype: metadata.tasktype || "STRUCTURE",
        plantype: metadata.plantype || "INSTANT",
        divetyp: metadata.divetyp || "ROV",
        topside: metadata.topside || 0,
        subsea: metadata.subsea || 0,
        istart: metadata.istart || "",
        iend: metadata.iend || "",
        contrac: metadata.contrac || "",
        comprep: metadata.comprep || "",
        vessel: metadata.vessel || "",
        contract_ref: metadata.contract_ref || "",
        contractor_ref: metadata.contractor_ref || "",
        site_hrs: metadata.site_hrs || 0,
      });
      if (metadata.structures) setSelectedStructures(metadata.structures);
      if (metadata.inspections) setSelectedInspections(metadata.inspections);
    }
  }, [data, form]);

  const availableStructures = useMemo(() => {
    const plats = platforms?.data?.map((p: any) => ({
      id: p.plat_id,
      str_id: p.plat_id,
      title: p.title,
      fieldName: p.pfield,
      type: "PLATFORM",
    })) || [];
    const pipes = pipelines?.data?.map((p: any) => ({
      id: p.pipe_id,
      str_id: p.pipe_id,
      title: p.title,
      fieldName: p.pfield,
      type: "PIPELINE",
    })) || [];
    return [...plats, ...pipes];
  }, [platforms, pipelines]);

  const filteredStructures = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return availableStructures;
    const words = query.split(/\s+/);

    return availableStructures.filter((s: any) => {
      const title = (s.title || "").toLowerCase();
      const field = (s.fieldName || "").toLowerCase();
      return words.every(word => title.includes(word) || field.includes(word));
    });
  }, [availableStructures, searchQuery]);

  const filteredInspections = useMemo(() => {
    const query = inspectionSearch.toLowerCase().trim();
    if (!query) return (inspectionTypes?.data || []);
    const words = query.split(/\s+/);

    return (inspectionTypes?.data || []).filter((i: any) => {
      const name = (i.name || "").toLowerCase();
      const code = (i.code || "").toLowerCase();
      return words.every(word => name.includes(word) || code.includes(word));
    });
  }, [inspectionTypes, inspectionSearch]);

  const toggleStructure = (s: any) => {
    if (selectedStructures.some((item) => item.id === s.id && item.type === s.type)) {
      setSelectedStructures(selectedStructures.filter((item) => !(item.id === s.id && item.type === s.type)));
    } else {
      setSelectedStructures([...selectedStructures, s]);
    }
  };

  const toggleInspection = (insp: any) => {
    if (selectedInspections.some((item) => item.id === insp.id)) {
      setSelectedInspections(selectedInspections.filter((item) => item.id !== insp.id));
    } else {
      setSelectedInspections([...selectedInspections, insp]);
    }
  };

  const onSubmit = async (values: JobpackValues) => {
    setIsSaving(true);
    const { id: _, name, status, metadata, ...rest } = values;

    const submissionValues = {
      name,
      status,
      metadata: {
        ...(metadata || {}),
        ...rest,
        structures: selectedStructures,
        inspections: selectedInspections,
      },
    };

    try {
      const url = isNew ? "/api/jobpack" : `/api/jobpack/${id}`;
      const method = isNew ? "POST" : "PUT";

      const response = await fetcher(url, {
        method,
        body: JSON.stringify(submissionValues),
      });

      toast.success(`Job Pack ${isNew ? "created" : "updated"} successfully`);
      if (isNew) {
        router.push("/dashboard/jobpack");
      } else {
        mutate(`/api/jobpack/${id}`);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Failed to ${isNew ? "create" : "update"} Job Pack`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading && !isNew) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Configuration...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/30 dark:bg-transparent animate-in fade-in duration-700">
      <div className="max-w-[1600px] mx-auto w-full p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
          <div className="flex items-center gap-5">
            <Link href="/dashboard/jobpack">
              <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
                <ChevronLeft className="h-6 w-6" />
              </Button>
            </Link>
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg">
              <Package className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                <span className="opacity-50">Operational</span>
                <div className="h-1 w-1 rounded-full bg-blue-500" />
                <span className="text-slate-900 dark:text-white/80">Fleet Execution</span>
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">
                {isNew ? "Register New Job Pack" : "Modify Job Pack"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              type="button"
              onClick={() => form.handleSubmit((v) => onSubmit(v))()}
              disabled={isSaving}
              className="rounded-xl h-12 px-6 font-bold border-slate-200 dark:border-slate-800"
            >
              Save Draft
            </Button>
            <Button
              type="button"
              onClick={() => form.handleSubmit((v) => onSubmit(v))()}
              disabled={isSaving}
              className="rounded-xl h-12 px-8 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20 transition-all gap-2"
            >
              {isSaving ? (
                <div className="h-4 w-4 border-2 border-blue-200 border-t-white rounded-full animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Finalize & Release
            </Button>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* Left Column: Job Pack Info */}
            <div className="xl:col-span-4 space-y-8">
              <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b p-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-black uppercase tracking-wider">Job Pack Info</CardTitle>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Core Details</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <FormFieldWrap label="Job Name" name="name" form={form} placeholder="e.g. UIMC2022/SKA/PIPE1" ftype="vertical" />

                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Task Type</Label>
                    <FormField
                      control={form.control}
                      name="tasktype"
                      render={({ field }) => (
                        <RadioGroup onValueChange={field.onChange} value={field.value || ""} className="flex gap-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="STRUCTURE" id="STRUCTURE" />
                            <Label htmlFor="STRUCTURE" className="text-xs font-bold uppercase cursor-pointer">Structure</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="COMPONENT" id="COMPONENT" />
                            <Label htmlFor="COMPONENT" className="text-xs font-bold uppercase cursor-pointer">Component</Label>
                          </div>
                        </RadioGroup>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormFieldWrap
                      label="Plan Type"
                      name="plantype"
                      form={form}
                      ftype="vselect"
                      options={[
                        { label: "INSTANT", value: "INSTANT" },
                        { label: "PLANNED", value: "PLANNED" }
                      ]}
                    />
                    <FormFieldWrap label="Dive Type" name="divetyp" form={form} ftype="vertical" placeholder="ROV" />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Project Scope</Label>
                    <div className="flex gap-8">
                      <FormFieldWrap label="Topside" name="topside" form={form} ftype="checkbox" />
                      <FormFieldWrap label="Subsea" name="subsea" form={form} ftype="checkbox" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormFieldWrap label="Start Date" name="istart" form={form} ftype="vertical" type="date" />
                    <FormFieldWrap label="End Date" name="iend" form={form} ftype="vertical" type="date" />
                  </div>

                  <FormFieldWrap label="Contractor" name="contrac" form={form} ftype="vertical" />
                  <FormFieldWrap label="Company Rep" name="comprep" form={form} ftype="vertical" />
                  <FormFieldWrap label="Vessel" name="vessel" form={form} ftype="vertical" />

                  <div className="grid grid-cols-2 gap-4">
                    <FormFieldWrap label="Contract Ref#" name="contract_ref" form={form} ftype="vertical" />
                    <FormFieldWrap label="Contractor Ref#" name="contractor_ref" form={form} ftype="vertical" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormFieldWrap label="Estimated Time" name="site_hrs" form={form} ftype="vertical" type="number" />
                    <FormFieldWrap
                      label="Status"
                      name="status"
                      form={form}
                      ftype="vselect"
                      options={[
                        { label: "OPEN", value: "OPEN" },
                        { label: "CLOSED", value: "CLOSED" }
                      ]}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Selections */}
            <div className="xl:col-span-8 space-y-8">
              {/* Asset Inventory */}
              <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-xl overflow-hidden">
                <CardHeader className="bg-white dark:bg-slate-900 border-b p-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-xl">
                        <Layers2 className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-black uppercase tracking-tight">Fleet Asset Inventory</CardTitle>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Available Structures</p>
                      </div>
                    </div>
                    <div className="relative w-full md:w-80">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search assets..."
                        className="rounded-2xl h-12 pl-12 bg-slate-50 dark:bg-slate-950 border-transparent focus:bg-white transition-all font-bold"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 text-slate-400 font-black text-[10px] uppercase tracking-widest border-b z-10">
                        <tr>
                          <th className="px-8 py-4">Structure</th>
                          <th className="px-8 py-4">Field</th>
                          <th className="px-8 py-4">Type</th>
                          <th className="px-8 py-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredStructures.map((s: any) => (
                          <tr key={`${s.type}-${s.id}`} className="group hover:bg-slate-50/50 transition-all">
                            <td className="px-8 py-4 font-bold text-xs">{s.title}</td>
                            <td className="px-8 py-4 text-xs text-slate-500">{s.fieldName}</td>
                            <td className="px-8 py-4">
                              <span className={cn(
                                "px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest",
                                s.type === "PLATFORM" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                              )}>
                                {s.type}
                              </span>
                            </td>
                            <td className="px-8 py-4 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleStructure(s)}
                                className={cn(
                                  "rounded-xl h-8 px-4 font-black text-[10px] uppercase tracking-widest transition-all",
                                  selectedStructures.some(sel => sel.id === s.id && sel.type === s.type)
                                    ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                                    : "bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white"
                                )}
                              >
                                {selectedStructures.some(sel => sel.id === s.id && sel.type === s.type) ? "Remove" : "Add"}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Inspection Selection */}
              <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-xl overflow-hidden">
                <CardHeader className="bg-white dark:bg-slate-900 border-b p-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xl">
                        <Activity className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-black uppercase tracking-tight">Inspection Selection</CardTitle>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Available Methods</p>
                      </div>
                    </div>
                    <div className="relative w-full md:w-80">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search inspections..."
                        className="rounded-2xl h-12 pl-12 bg-slate-50 dark:bg-slate-950 border-transparent focus:bg-white transition-all font-bold"
                        value={inspectionSearch}
                        onChange={(e) => setInspectionSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 text-slate-400 font-black text-[10px] uppercase tracking-widest border-b z-10">
                        <tr>
                          <th className="px-8 py-4">Method Name</th>
                          <th className="px-8 py-4">Code</th>
                          <th className="px-8 py-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredInspections.map((insp: any) => (
                          <tr key={insp.id} className="group hover:bg-slate-50/50 transition-all">
                            <td className="px-8 py-4 font-bold text-xs">{insp.name}</td>
                            <td className="px-8 py-4 text-xs text-slate-500 font-mono tracking-wider">{insp.code}</td>
                            <td className="px-8 py-4 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleInspection(insp)}
                                className={cn(
                                  "rounded-xl h-8 px-4 font-black text-[10px] uppercase tracking-widest transition-all",
                                  selectedInspections.some(sel => sel.id === insp.id)
                                    ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                                    : "bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white"
                                )}
                              >
                                {selectedInspections.some(sel => sel.id === insp.id) ? "Remove" : "Add"}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Selected Items Summary Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-xl overflow-hidden bg-slate-900 text-white">
                  <CardHeader className="border-b border-white/10 p-6 bg-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Navigation className="h-5 w-5 text-blue-400" />
                        <CardTitle className="text-sm font-black uppercase tracking-wider">Queued Assets</CardTitle>
                      </div>
                      <span className="text-[10px] font-black px-2 py-1 rounded bg-white/10">{selectedStructures.length}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                    {selectedStructures.map((s, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 group">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-black">{i + 1}</div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-tight">{s.title}</div>
                            <div className="text-[8px] font-bold text-white/40 uppercase tracking-widest">{s.type}</div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleStructure(s)}
                          className="h-8 w-8 text-white/30 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-xl overflow-hidden bg-slate-900 text-white">
                  <CardHeader className="border-b border-white/10 p-6 bg-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="h-5 w-5 text-indigo-400" />
                        <CardTitle className="text-sm font-black uppercase tracking-wider">Assigned Inspections</CardTitle>
                      </div>
                      <span className="text-[10px] font-black px-2 py-1 rounded bg-white/10">{selectedInspections.length}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                    {selectedInspections.map((insp, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 group">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-black">{i + 1}</div>
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-tight">{insp.name}</div>
                            <div className="text-[8px] font-bold text-white/40 uppercase tracking-widest">{insp.code}</div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleInspection(insp)}
                          className="h-8 w-8 text-white/30 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
