"use client";
import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  CheckCircle,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  // Managed per structure: Key is `${s.type}-${s.id}`
  const [inspectionsByStruct, setInspectionsByStruct] = useState<Record<string, any[]>>({});
  const [activeStructKey, setActiveStructKey] = useState<string | null>(null);
  const [compTypesByStruct, setCompTypesByStruct] = useState<Record<string, string[]>>({});
  const [jobTypeByStruct, setJobTypeByStruct] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const { data, isLoading } = useSWR(id ? `/api/jobpack/${id}` : null, fetcher);
  const { data: platforms } = useSWR("/api/platform", fetcher);
  const { data: pipelines } = useSWR("/api/pipeline", fetcher);
  const { data: inspectionTypes } = useSWR("/api/inspection-type?pageSize=1000", fetcher);
  const { data: contractors } = useSWR("/api/library/CONTR_NAM", fetcher);
  const { data: compTypesLib } = useSWR("/api/components", fetcher);

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
      if (metadata.inspections) {
        if (Array.isArray(metadata.inspections)) {
          // Migration: Assign legacy global list to all structures
          const map: Record<string, any[]> = {};
          (metadata.structures || []).forEach((s: any) => {
            map[`${s.type}-${s.id}`] = metadata.inspections;
          });
          setInspectionsByStruct(map);
        } else {
          setInspectionsByStruct(metadata.inspections);
        }
      }
      if (metadata.compTypes) setCompTypesByStruct(metadata.compTypes);
      if (metadata.jobTypes) setJobTypeByStruct(metadata.jobTypes);
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

  const contractorOptions = useMemo(() => {
    if (!contractors?.data) return [];
    return contractors.data
      .filter((c: any) => !c.lib_delete || c.lib_delete === 0)
      .map((c: any) => ({ label: c.lib_desc, value: String(c.lib_id || c.lib_val) }));
  }, [contractors]);

  const toggleStructure = (s: any) => {
    const isSelected = selectedStructures.some((item) => item.id === s.id && item.type === s.type);

    if (isSelected) {
      setSelectedStructures(selectedStructures.filter((item) => !(item.id === s.id && item.type === s.type)));
    } else {
      setSelectedStructures([...selectedStructures, s]);
      const newKey = `${s.type}-${s.id}`;
      setActiveStructKey(newKey);

      // Auto-select defaults based on metadata
      if (inspectionTypes?.data) {
        const defaults = inspectionTypes.data.filter((insp: any) => {
          const m = insp.metadata || {};
          // Must have default=1
          if (m.default !== 1 && m.default !== "1" && m.default !== true) return false;

          // Must match scope
          if (s.type === "PLATFORM") {
            const p = m.platform;
            return p === 1 || p === "1" || p === true;
          }
          if (s.type === "PIPELINE") {
            const p = m.pipeline;
            return p === 1 || p === "1" || p === true;
          }
          return false;
        });

        if (defaults.length > 0) {
          setInspectionsByStruct(prev => ({
            ...prev,
            [newKey]: defaults
          }));
          toast.success(`Auto-selected ${defaults.length} inspection(s) for ${s.title}`);
        }
      }
    }
  };

  // Sync activeStructKey with selection
  useEffect(() => {
    if (selectedStructures.length === 0) {
      setActiveStructKey(null);
      return;
    }
    // If active key is no longer in selection, default to first
    if (!activeStructKey || !selectedStructures.some(s => `${s.type}-${s.id}` === activeStructKey)) {
      const first = selectedStructures[0];
      setActiveStructKey(`${first.type}-${first.id}`);
    }
  }, [selectedStructures, activeStructKey]);

  const toggleInspection = (insp: any) => {
    if (!activeStructKey) {
      toast.error("Please select a structure first");
      return;
    }
    const currentList = inspectionsByStruct[activeStructKey] || [];
    const exists = currentList.some((item) => item.id === insp.id);

    let newList: any[] = [];
    if (exists) {
      const remainingList = currentList.filter((item) => item.id !== insp.id);

      // Auto-remove Dependencies logic
      const removedDeps = insp.metadata?.requires || []; // codes to potentially remove
      if (Array.isArray(removedDeps) && removedDeps.length > 0) {
        // 1. Identify what is still required by other selected items
        const stillRequiredCodes = new Set<string>();
        remainingList.forEach((item) => {
          const reqs = item.metadata?.requires;
          if (Array.isArray(reqs)) {
            reqs.forEach((r: string) => stillRequiredCodes.add(r));
          }
        });

        // 2. Identify codes that are safe to remove (dependent on 'insp' but not others)
        const safeToRemoveCodes = removedDeps.filter((code: string) => !stillRequiredCodes.has(code));

        // 3. Remove them from the list
        if (safeToRemoveCodes.length > 0) {
          newList = remainingList.filter((item) => !safeToRemoveCodes.includes(item.code));
          const removedCount = remainingList.length - newList.length;
          if (removedCount > 0) {
            toast.info(`Also removed ${removedCount} dependent inspection(s)`);
          }
        } else {
          newList = remainingList;
        }
      } else {
        newList = remainingList;
      }
    } else {
      newList = [...currentList, insp];

      // Auto-select Dependencies (requires)
      const requirements = insp.metadata?.requires; // Array of codes
      if (Array.isArray(requirements) && requirements.length > 0 && inspectionTypes?.data) {
        let addedCount = 0;
        const reqNames: string[] = [];

        // Find matching inspection types
        const deps = inspectionTypes.data.filter((d: any) =>
          requirements.includes(d.code) && d.id !== insp.id
        );

        deps.forEach((d: any) => {
          // Check if already selected
          const alreadySelected = newList.some(sel => sel.id === d.id);
          if (!alreadySelected) {
            newList.push(d);
            addedCount++;
            reqNames.push(d.code);
          }
        });

        if (addedCount > 0) {
          toast.success(`Auto-added required: ${reqNames.join(", ")}`);
        }
      }
    }

    setInspectionsByStruct({
      ...inspectionsByStruct,
      [activeStructKey]: newList
    });
  };

  const onSubmit = async (values: JobpackValues) => {
    // Validation
    const hasScope = values.topside || values.subsea;
    if (!hasScope) {
      toast.error("Please select at least one Project Scope (Topside or Subsea)");
      return;
    }
    if (selectedStructures.length === 0) {
      toast.error("Please add at least one asset to the scope");
      return;
    }
    if (values.tasktype === "COMPONENT") {
      const missing = selectedStructures.some(s => {
        const key = `${s.type}-${s.id}`;
        return !compTypesByStruct[key] || compTypesByStruct[key].length === 0;
      });
      if (missing) {
        toast.error("Please select at least one Component Type for all added assets");
        return;
      }
    }

    setIsSaving(true);
    const { id: _, name, status, metadata, ...rest } = values;

    // Clean up inspections for removed structures
    const cleanInspections: Record<string, any[]> = {};
    selectedStructures.forEach((s: any) => {
      const key = `${s.type}-${s.id}`;
      if (inspectionsByStruct[key]) {
        cleanInspections[key] = inspectionsByStruct[key];
      }
    });

    const submissionValues = {
      name,
      status,
      metadata: {
        ...(metadata || {}),
        ...rest,
        structures: selectedStructures,
        inspections: cleanInspections,
        compTypes: compTypesByStruct,
        jobTypes: jobTypeByStruct,
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

  const selectedContractorId = form.watch("contrac");
  const selectedContractor = useMemo(() => {
    return contractors?.data?.find((c: any) => String(c.lib_id || c.lib_val) === selectedContractorId);
  }, [contractors, selectedContractorId]);

  const isClosed = !isNew && data?.data?.status === "CLOSED";

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
              {isClosed && (
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-500 rounded-full mt-2 text-[10px] font-bold uppercase tracking-wide border border-slate-200">
                  <ShieldCheck className="w-3 h-3" /> Read Only (Closed)
                </div>
              )}
            </div>
          </div>

          {!isClosed && (
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
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset disabled={isClosed} className="grid grid-cols-1 xl:grid-cols-12 gap-8 w-full group-disabled">
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

                    </div>

                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dive Type</Label>
                      <FormField
                        control={form.control}
                        name="divetyp"
                        render={({ field }) => (
                          <div className="h-32 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-950 space-y-2 custom-scrollbar">
                            {['ROV', 'AIR DIVING', 'SAT DIVING', 'ROPE ACCESS'].map((mode) => (
                              <div key={mode} className="flex items-center space-x-3 p-1 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-colors">
                                <Checkbox
                                  id={mode}
                                  checked={field.value?.includes(mode)}
                                  onCheckedChange={(checked) => {
                                    const current = field.value ? field.value.split(',') : [];
                                    let newVals;
                                    if (checked) newVals = [...current, mode];
                                    else newVals = current.filter((v: string) => v !== mode);
                                    field.onChange(newVals.join(','));
                                  }}
                                />
                                <Label htmlFor={mode} className="text-xs font-bold uppercase cursor-pointer flex-1">{mode}</Label>
                              </div>
                            ))}
                          </div>
                        )}
                      />
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
                      {!isNew && <FormFieldWrap label="End Date" name="iend" form={form} ftype="vertical" type="date" />}
                    </div>

                    <div className="flex gap-4 items-start">
                      <div className="flex-1 space-y-2">
                        <FormFieldWrap
                          label="Contractor"
                          name="contrac"
                          form={form}
                          ftype="vselect"
                          options={contractorOptions}
                          placeholder="Select Contractor"
                        />
                        {selectedContractor?.lib_com && (
                          <div className="text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 leading-relaxed">
                            <span className="font-bold uppercase text-[9px] text-slate-400 block mb-0.5">Address / Details</span>
                            {selectedContractor.lib_com}
                          </div>
                        )}
                      </div>
                      {selectedContractor && (
                        <div className="w-20 h-20 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white p-1 flex items-center justify-center shrink-0 shadow-sm mt-6">
                          {selectedContractor.logo_url ? (
                            <img
                              src={selectedContractor.logo_url}
                              alt="Logo"
                              className="w-full h-full object-contain rounded-xl"
                            />
                          ) : (
                            <div className="text-[8px] text-slate-300 font-bold uppercase text-center">No Logo</div>
                          )}
                        </div>
                      )}
                    </div>
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
                        disabled
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Selections */}
              <div className="xl:col-span-8 space-y-6">
                {/* 1. Asset Inventory (Add to Scope) */}
                <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-lg overflow-hidden border-orange-100 bg-orange-50/10">
                  <CardHeader className="bg-white/50 dark:bg-slate-900/50 border-b p-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Search className="w-4 h-4" /></div>
                        <span className="font-bold text-sm uppercase text-slate-700">Add Assets to Scope</span>
                      </div>
                      <Input
                        placeholder="Search & Add Assets..."
                        className="w-64 h-8 text-xs rounded-lg bg-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 border-b max-h-[200px] overflow-y-auto custom-scrollbar bg-white">
                    <table className="w-full text-left">
                      <tbody className="divide-y divide-slate-50">
                        {filteredStructures.slice(0, 50).map((s: any) => {
                          const isSelected = selectedStructures.some(sel => sel.id === s.id && sel.type === s.type);
                          return (
                            <tr key={`${s.type}-${s.id}`} className="hover:bg-slate-50">
                              <td className="px-4 py-2 text-xs font-bold text-slate-700">{s.title}</td>
                              <td className="px-4 py-2 text-xs text-slate-500">{s.fieldName}</td>
                              <td className="px-4 py-2 text-xs text-slate-400 uppercase">{s.type}</td>
                              <td className="px-4 py-2 text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[10px] uppercase font-bold text-blue-600 hover:bg-blue-50"
                                  onClick={() => toggleStructure(s)}
                                  disabled={isSelected}
                                >
                                  {isSelected ? "Added" : "Add"}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredStructures.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-xs text-slate-400 uppercase font-bold">
                              No assets found
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                {/* 2. Unified Scope Definition Board */}
                <Card className="rounded-[2.5rem] border-slate-200/60 dark:border-slate-800/60 shadow-2xl overflow-hidden flex flex-col min-h-[600px] bg-white dark:bg-slate-950">
                  <div className="flex flex-col md:flex-row h-full flex-1 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">

                    {/* Left Pane: Selected Structures List */}
                    <div className="w-full md:w-[35%] flex flex-col bg-slate-50/50 dark:bg-slate-900/50">
                      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div>
                          <h3 className="font-black text-sm uppercase tracking-wide text-slate-800 dark:text-slate-200">Work Scope</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Defined Structures</p>
                        </div>
                        <Badge variant="secondary" className="bg-white shadow-sm border text-slate-600">{selectedStructures.length}</Badge>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                        {selectedStructures.length > 0 ? selectedStructures.map((s, i) => {
                          const key = `${s.type}-${s.id}`;
                          const isActive = activeStructKey === key;
                          const assignedInspections = inspectionsByStruct[key] || [];

                          return (
                            <div
                              key={key}
                              onClick={() => setActiveStructKey(key)}
                              className={cn(
                                "group relative p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md",
                                isActive
                                  ? "bg-white dark:bg-slate-800 border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/20"
                                  : "bg-white dark:bg-slate-950 border-transparent hover:border-slate-200"
                              )}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black", isActive ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400")}>
                                    {i + 1}
                                  </div>
                                  <span className={cn("font-bold text-sm", isActive ? "text-slate-900" : "text-slate-600")}>{s.title}</span>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-slate-300 hover:text-rose-500 -mr-2 -mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => { e.stopPropagation(); toggleStructure(s); }}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>

                              {/* Inspection Summary Badges */}
                              <div className="flex flex-wrap gap-1.5 min-h-[1.5rem]">
                                {assignedInspections.length > 0 ? (
                                  assignedInspections.map((insp: any) => (
                                    <span key={insp.id} className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[9px] font-bold border border-blue-100 uppercase tracking-tight">
                                      {insp.code}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] italic text-slate-400">No inspections assigned</span>
                                )}
                              </div>
                            </div>
                          );
                        }) : (
                          <div className="flex flex-col items-center justify-center h-40 text-center p-4">
                            <div className="w-10 h-10 rounded-full bg-slate-200/50 flex items-center justify-center mb-2 text-slate-400">
                              <Layers2 className="w-5 h-5" />
                            </div>
                            <p className="text-xs font-bold text-slate-400">No structures added</p>
                            <p className="text-[10px] text-slate-400 mt-1">Search assets above to begin value</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Pane: Inspection Config */}
                    <div className="w-full md:w-[65%] flex flex-col bg-slate-50/10 p-0 relative">
                      {activeStructKey ? (
                        <>
                          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 sticky top-0 z-10">
                            <div className="flex items-center gap-3 mb-2">
                              <ShieldCheck className="w-5 h-5 text-blue-600" />
                              <h3 className="font-black text-lg uppercase tracking-tight text-slate-900 dark:text-white">
                                {selectedStructures.find(s => `${s.type}-${s.id}` === activeStructKey)?.title}
                              </h3>
                            </div>
                            <p className="text-xs text-slate-500 font-medium ml-8">Select required inspections for this location</p>

                            {/* Job Type Selector (Per Structure) */}
                            <div className="mt-4 mb-2">
                              <Label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Job Type</Label>
                              <div className="flex flex-wrap gap-2">
                                {["Major", "Partial", "Pipeline", "Special"].map((jt) => {
                                  const isSelected = jobTypeByStruct[activeStructKey] === jt;
                                  return (
                                    <Badge
                                      key={jt}
                                      variant={isSelected ? "default" : "outline"}
                                      className={cn("cursor-pointer select-none transition-colors px-3 py-1",
                                        isSelected ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}
                                      onClick={() => setJobTypeByStruct({ ...jobTypeByStruct, [activeStructKey]: jt })}
                                    >
                                      {jt}
                                    </Badge>
                                  )
                                })}
                              </div>
                            </div>

                            {/* Component Type Selector (Conditional) */}
                            {form.watch("tasktype") === "COMPONENT" && (
                              <div className="mt-4 mb-2">
                                <Label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Component Type</Label>
                                {(compTypesLib?.data || []).length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {(compTypesLib?.data || [])
                                      .filter((c: any) => {
                                        if (!activeStructKey) return true;
                                        if (activeStructKey.startsWith("PLATFORM")) return c.plat === 1;
                                        if (activeStructKey.startsWith("PIPELINE")) return c.pipe === 1;
                                        return true;
                                      })
                                      .map((c: any) => {
                                        const idVal = String(c.id);
                                        const currentSelected = compTypesByStruct[activeStructKey] || [];
                                        const isSelected = currentSelected.includes(idVal);
                                        return (
                                          <Badge
                                            key={idVal}
                                            variant={isSelected ? "default" : "secondary"}
                                            className={cn("cursor-pointer border select-none transition-colors px-3 py-1",
                                              isSelected ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}
                                            onClick={() => {
                                              const newSelection = isSelected
                                                ? currentSelected.filter(id => id !== idVal)
                                                : [...currentSelected, idVal];
                                              setCompTypesByStruct({ ...compTypesByStruct, [activeStructKey]: newSelection });
                                            }}
                                          >
                                            {c.name}
                                          </Badge>
                                        )
                                      })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-red-400 italic">No component types found.</p>
                                )}
                              </div>
                            )}

                            {/* Quick Filter */}
                            <div className="mt-4 relative">
                              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                              <Input
                                placeholder="Filter inspection types..."
                                className="h-9 pl-9 text-xs rounded-xl bg-slate-50 border-slate-200"
                                value={inspectionSearch}
                                onChange={(e) => setInspectionSearch(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-slate-950">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {inspectionTypes?.data?.filter((insp: any) => {
                                // Text Filter
                                if (inspectionSearch) {
                                  const search = inspectionSearch.toLowerCase();
                                  const matches = (insp.name?.toLowerCase().includes(search)) ||
                                    (insp.code?.toLowerCase().includes(search));
                                  if (!matches) return false;
                                }
                                // Structure Type Filter
                                if (activeStructKey) {
                                  if (activeStructKey.startsWith("PLATFORM")) {
                                    const val = insp.metadata?.platform;
                                    return val === 1 || val === "1" || val === true;
                                  }
                                  if (activeStructKey.startsWith("PIPELINE")) {
                                    const val = insp.metadata?.pipeline;
                                    return val === 1 || val === "1" || val === true;
                                  }
                                }
                                return true;
                              }).map((insp: any) => {
                                const isSelected = inspectionsByStruct[activeStructKey]?.some((sel: any) => sel.id === insp.id);

                                return (
                                  <div
                                    key={insp.id}
                                    onClick={() => toggleInspection(insp)}
                                    className={cn(
                                      "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all select-none",
                                      isSelected
                                        ? "bg-blue-50 border-blue-200 shadow-sm"
                                        : "bg-white border-slate-100 hover:border-blue-200 hover:shadow-sm"
                                    )}
                                  >
                                    <div className={cn(
                                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                                      isSelected ? "bg-blue-600 border-blue-600" : "border-slate-300 bg-white"
                                    )}>
                                      {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <span className={cn("font-bold text-xs truncate", isSelected ? "text-blue-900" : "text-slate-700")}>{insp.name}</span>
                                      <span className="text-[10px] font-mono text-slate-400 mt-0.5">{insp.code}</span>
                                      <div className="flex gap-1 mt-1 flex-wrap">
                                        {(insp.metadata?.rov === 1 || insp.metadata?.rov === "1" || insp.metadata?.rov === true) && (
                                          <Badge variant="secondary" className="text-[8px] h-4 px-1 bg-sky-100 text-sky-700 hover:bg-sky-200 border-sky-200">ROV</Badge>
                                        )}
                                        {(insp.metadata?.diving === 1 || insp.metadata?.diving === "1" || insp.metadata?.diving === true) && (
                                          <Badge variant="secondary" className="text-[8px] h-4 px-1 bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200">DIVING</Badge>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-10 select-none">
                          <Activity className="w-16 h-16 mb-4 opacity-20" />
                          <p className="text-xl font-black uppercase text-slate-200">No Selection</p>
                          <p className="text-sm font-medium mt-2 max-w-[200px] text-center">Select a structure from the left list to configure inspections</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </fieldset>
          </form>
        </Form>
      </div>
    </div >
  );
}
