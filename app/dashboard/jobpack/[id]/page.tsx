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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { VesselManager, VesselRecord } from "@/components/jobpack/vessel-manager";
import { SOWDialog } from "@/components/jobpack/sow-dialog";


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
  const [inspectionModeTab, setInspectionModeTab] = useState("diving");
  const [selectedStructures, setSelectedStructures] = useState<any[]>([]);
  // Managed per structure: Key is `${s.type}-${s.id}`
  const [inspectionsByStruct, setInspectionsByStruct] = useState<Record<string, any[]>>({});
  const [activeStructKey, setActiveStructKey] = useState<string | null>(null);
  const [compTypesByStruct, setCompTypesByStruct] = useState<Record<string, string[]>>({});
  const [jobTypeByStruct, setJobTypeByStruct] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [vesselHistory, setVesselHistory] = useState<VesselRecord[]>([]);

  // SOW Dialog state
  const [sowDialogOpen, setSOWDialogOpen] = useState(false);
  const [sowStructure, setSOWStructure] = useState<any>(null);
  const [sowComponents, setSOWComponents] = useState<any[]>([]);

  const searchParams = useSearchParams();










  const { data, isLoading } = useSWR(id ? `/api/jobpack/${id}` : null, fetcher);
  const { data: platforms } = useSWR("/api/platform", fetcher);
  const { data: pipelines } = useSWR("/api/pipeline", fetcher);
  const { data: inspectionTypes } = useSWR("/api/inspection-type?pageSize=1000", fetcher);
  const { data: contractors } = useSWR("/api/library/CONTR_NAM", fetcher);
  const { data: compTypesLib } = useSWR("/api/components", fetcher);


  // Consolidation Logic
  const [consolidationOpen, setConsolidationOpen] = useState(false);
  const [structureStatus, setStructureStatus] = useState<Record<string, any>>({});

  useEffect(() => {
    if (data?.data?.metadata?.structure_status) {
      setStructureStatus(data.data.metadata.structure_status);
    }
  }, [data]);



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
      istart: moment().format("YYYY-MM-DD"),
      iend: "",
      contrac: "",
      comprep: "",
      vessel: "",
      contract_ref: "",
      contractor_ref: "",
      site_hrs: 0,
    },
  });

  // Simple contractor options - just map the data directly
  const contractorOptions = useMemo(() => {
    if (!contractors?.data) {
      return [];
    }

    // Filter out deleted contractors first
    const activeContractors = contractors.data.filter((c: any) => {
      // Active if lib_delete is null, 0, "0", or empty
      return !c.lib_delete || c.lib_delete === 0 || c.lib_delete === "0" || c.lib_delete === "";
    });

    // Use a Map to remove duplicates by lib_id
    const uniqueMap = new Map();
    activeContractors.forEach((c: any, index: number) => {
      const val = String(c.lib_id || '').trim();
      const label = String(c.lib_desc || '').trim();

      if (val && label && !uniqueMap.has(val)) {
        uniqueMap.set(val, { label, value: val });
      }
    });

    const options = Array.from(uniqueMap.values());

    return options;
  }, [contractors]);

  useEffect(() => {
    // Wait for both data and contractors to load
    if (data?.data && contractors) {
      const jobpack = data.data;
      const metadata = jobpack.metadata || {};

      // Simple: just use the contractor value from metadata
      const contractorValue = String(metadata.contrac || "").trim();

      // Vessel History Migration/Initialization
      let loadedVessels: VesselRecord[] = [];
      if (metadata.vessel_history && Array.isArray(metadata.vessel_history)) {
        loadedVessels = metadata.vessel_history;
      } else if (metadata.vessel || jobpack.vessel) {
        // Migration: Create initial record from legacy single field
        const legacyName = metadata.vessel || jobpack.vessel;
        // Use istart as default mob date if available, otherwise today
        const legacyDate = metadata.istart || moment().format("YYYY-MM-DD");
        loadedVessels = [{
          id: crypto.randomUUID(),
          name: String(legacyName),
          date: legacyDate
        }];
      }
      setVesselHistory(loadedVessels);

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
        contrac: contractorValue,
        comprep: metadata.comprep || "",
        vessel: loadedVessels.length > 0
          ? [...loadedVessels].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].name
          : (metadata.vessel || ""),
        contract_ref: metadata.contract_ref || "",
        contractor_ref: metadata.contractor_ref || "",
        site_hrs: metadata.site_hrs || 0,
      });

      if (metadata.structures) setSelectedStructures(metadata.structures);
      if (metadata.inspections) {
        if (Array.isArray(metadata.inspections)) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, contractorOptions]);

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

  // Handle SOW dialog opening from URL parameters
  // Handle SOW dialog opening from URL parameters
  useEffect(() => {
    const tab = searchParams.get("tab");
    const structureKey = searchParams.get("structure");

    if (tab === "sow" && selectedStructures.length > 0) {
      let structure = null;
      if (structureKey) {
        structure = selectedStructures.find(
          (s) => `${s.type}-${s.id}` === structureKey
        );
      } else {
        // Default to first structure if none specified in URL
        structure = selectedStructures[0];
      }

      if (structure) {
        setSOWStructure(structure);
        setActiveStructKey(`${structure.type}-${structure.id}`);
        setSOWDialogOpen(true);
      }
    }
  }, [searchParams, selectedStructures]);

  // Fetch components when SOW dialog opens
  useEffect(() => {
    const fetchComponents = async () => {
      if (sowStructure && sowDialogOpen) {
        try {
          console.log("Fetching components for structure:", sowStructure.id);
          const response = await fetch(`/api/structure-components?structure_id=${sowStructure.id}`);
          const result = await response.json();
          console.log("Components API response:", result);
          setSOWComponents(result.data || []);
        } catch (error) {
          console.error("Error fetching components:", error);
          setSOWComponents([]);
        }
      }
    };

    fetchComponents();
  }, [sowStructure, sowDialogOpen]);



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

  const toggleInspection = (insp: any, structureKey?: string) => {
    const targetKey = structureKey || activeStructKey;
    if (!targetKey) {
      toast.error("Please select a structure first");
      return;
    }
    const currentList = inspectionsByStruct[targetKey] || [];
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
      [targetKey]: newList
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
        vessel_history: vesselHistory,
        vessel: vesselHistory.length > 0
          ? [...vesselHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].name
          : (values.vessel || ""),
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
    return contractors?.data?.find((c: any) => String(c.lib_id) === selectedContractorId);
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
              {!isNew && (
                <Button
                  type="button"
                  onClick={() => router.push(`/dashboard/jobpack/${id}/consolidate`)}
                  className="rounded-xl h-12 px-6 font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200 dark:shadow-none"
                >
                  Consolidate
                </Button>
              )}
              {!isNew && selectedStructures.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (activeStructKey) {
                      const activeStruct = selectedStructures.find(
                        (s) => `${s.type}-${s.id}` === activeStructKey
                      );
                      if (activeStruct) {
                        router.push(`/dashboard/jobpack/${id}?tab=sow&structure=${activeStructKey}`);
                      }
                    } else {
                      toast.error("Please select a structure first");
                    }
                  }}
                  className="rounded-xl h-12 px-6 font-bold border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all gap-2"
                >
                  <FileText className="h-4 w-4" />
                  SOW
                </Button>
              )}
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
                      {isClosed ? (
                        <div className="flex flex-col gap-2">
                          <div className="w-full text-sm font-medium">Plan Type</div>
                          <Input value={form.getValues("plantype") || ""} disabled className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500" />
                        </div>
                      ) : (
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
                      )}

                    </div>

                    <div className="space-y-4">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dive Type</Label>
                      <FormField
                        control={form.control}
                        name="divetyp"
                        render={({ field }) => (
                          <div className="flex gap-4 border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-950">
                            {['ROV', 'AIR DIVING', 'SAT DIVING'].map((mode) => (
                              <div key={mode} className="flex items-center space-x-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-colors px-2 py-1">
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
                                <Label htmlFor={mode} className="text-xs font-bold uppercase cursor-pointer">{mode}</Label>
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


                    {isClosed ? (
                      <div className="grid grid-cols-2 gap-4">
                        <FormFieldWrap label="Start Date" name="istart" form={form} ftype="vertical" type="date" disabled />
                        <FormFieldWrap label="End Date" name="iend" form={form} ftype="vertical" type="date" disabled />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <FormFieldWrap label="Start Date" name="istart" form={form} ftype="vertical" type="date" />
                      </div>
                    )}


                    <div className="flex gap-4 items-start">
                      <div className="flex-1 space-y-2">
                        {isClosed ? (
                          <div className="flex flex-col gap-2">
                            <div className="w-full text-sm font-medium">Contractor</div>
                            <Input value={selectedContractor?.lib_desc || form.getValues("contrac") || ""} disabled className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500" />
                          </div>
                        ) : (
                          <FormField
                            control={form.control}
                            name="contrac"
                            render={({ field }) => (
                              <FormItem className="flex flex-col gap-2">
                                <div className="w-full text-sm font-medium">Contractor</div>
                                <Select
                                  key={field.value || 'no-contractor'}
                                  onValueChange={field.onChange}
                                  value={field.value || undefined}
                                  defaultValue={field.value || undefined}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select Contractor" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      <SelectLabel>Contractor</SelectLabel>
                                      {contractorOptions.map((item, index) => (
                                        <SelectItem key={index} value={item.value}>
                                          {item.label}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        {selectedContractor?.lib_com && (
                          <div className="text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 leading-relaxed">
                            <span className="font-bold uppercase text-[9px] text-slate-400 block mb-0.5">Address / Details</span>
                            {selectedContractor.lib_com}
                          </div>
                        )}
                      </div>
                      {selectedContractor && (
                        <div className="w-20 h-20 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 flex items-center justify-center shrink-0 shadow-sm mt-6">
                          {selectedContractor.logo_url ? (
                            <img
                              src={selectedContractor.logo_url}
                              alt="Logo"
                              className="w-full h-full object-contain rounded-xl"
                            />
                          ) : (
                            <div className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase text-center">No Logo</div>
                          )}
                        </div>
                      )}
                    </div>
                    <FormFieldWrap label="Company Rep" name="comprep" form={form} ftype="vertical" />
                    <VesselManager
                      vessels={vesselHistory}
                      onChange={(updated) => {
                        setVesselHistory(updated);
                        // Update the form field for 'vessel' to be the latest date
                        const latest = updated.length > 0
                          ? [...updated].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].name
                          : "";
                        form.setValue("vessel", latest);
                      }}
                      isReadOnly={isClosed}
                    />




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

                    <FormField
                      control={form.control}
                      name="idesc"
                      render={({ field }) => (
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Remarks</Label>
                          <textarea
                            className="flex min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:focus-visible:ring-slate-300"
                            placeholder="Enter description or remarks..."
                            {...field}
                            value={field.value || ""}
                          />
                        </div>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Selections */}
              <div className="xl:col-span-8 space-y-6">
                {/* 1. Asset Inventory (Add to Scope) - Hidden if Closed */}
                {!isClosed && (
                  <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-lg overflow-hidden border-orange-100 dark:border-slate-800 bg-orange-50/10 dark:bg-slate-900/20">
                    <CardHeader className="bg-white/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 p-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-lg"><Search className="w-4 h-4" /></div>
                          <span className="font-bold text-sm uppercase text-slate-700 dark:text-slate-200">Add Structure to Scope</span>
                        </div>
                        <Input
                          placeholder="Search & Add Structure..."
                          className="w-64 h-8 text-xs rounded-lg bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </CardHeader>
                    {searchQuery && (
                      <CardContent className="p-0 border-b border-slate-100 dark:border-slate-800 max-h-[200px] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-950">
                        <table className="w-full text-left">
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                            {filteredStructures.slice(0, 50).map((s: any) => {
                              const isSelected = selectedStructures.some(sel => sel.id === s.id && sel.type === s.type);
                              return (
                                <tr key={`${s.type}-${s.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                  <td className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200">{s.title}</td>
                                  <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">{s.fieldName}</td>
                                  <td className="px-4 py-2 text-xs text-slate-400 dark:text-slate-500 uppercase">{s.type}</td>
                                  <td className="px-4 py-2 text-right">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
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
                                <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-400 uppercase font-bold">
                                  No structures found
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </CardContent>
                    )}
                  </Card>
                )}

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
                        <Badge variant="secondary" className="bg-white dark:bg-slate-800 shadow-sm border dark:border-slate-700 text-slate-600 dark:text-slate-200">{selectedStructures.length}</Badge>
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
                                  : "bg-white dark:bg-slate-950/50 border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                              )}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black", isActive ? "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500")}>
                                    {i + 1}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className={cn("font-bold text-sm", isActive ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400")}>{s.title}</span>
                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 lowercase">{s.type}</span>
                                  </div>
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
                                    <TooltipProvider key={insp.id}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="group/badge relative px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-bold border border-blue-100 dark:border-blue-500/20 uppercase tracking-tight cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors">
                                            {insp.code}
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (!isClosed && structureStatus[key]?.status !== "CLOSED") {
                                                  // Show confirmation dialog
                                                  const confirmed = window.confirm(
                                                    `Are you sure you want to remove "${insp.name}" (${insp.code}) from this structure?\n\nThis action cannot be undone.`
                                                  );
                                                  if (confirmed) {
                                                    toggleInspection(insp, key);
                                                  }
                                                }
                                              }}
                                              className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/badge:opacity-100 transition-opacity hover:bg-red-600"
                                              disabled={isClosed || structureStatus[key]?.status === "CLOSED"}
                                            >
                                              <X className="w-2 h-2" />
                                            </button>
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="text-xs font-medium">{insp.name}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ))
                                ) : (
                                  <span className="text-[10px] italic text-slate-400 dark:text-slate-500">No inspections assigned</span>
                                )}
                              </div>
                            </div>
                          );
                        }) : (
                          <div className="flex flex-col items-center justify-center h-40 text-center p-4">
                            <div className="w-10 h-10 rounded-full bg-slate-200/50 dark:bg-slate-800/50 flex items-center justify-center mb-2 text-slate-400 dark:text-slate-500">
                              <Layers2 className="w-5 h-5" />
                            </div>
                            <p className="text-xs font-bold text-slate-400 dark:text-slate-500">No structures added</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">Search assets above to begin value</p>
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
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium ml-8">Select required inspections for this location</p>

                            {/* Job Type Selector (Per Structure) */}
                            <div className="mt-4 mb-2">
                              <Label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Job Type</Label>
                              <div className="flex flex-wrap gap-2">
                                {["Major", "Partial", "Pipeline", "Special"].map((jt) => {
                                  const isSelected = jobTypeByStruct[activeStructKey] === jt;
                                  const isLocked = isClosed || structureStatus[activeStructKey]?.status === "CLOSED";
                                  return (
                                    <Badge
                                      key={jt}
                                      variant={isSelected ? "default" : "outline"}
                                      className={cn("select-none transition-colors px-3 py-1",
                                        isLocked ? "opacity-50 cursor-not-allowed pointer-events-none" : "cursor-pointer",
                                        isSelected ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800")}
                                      onClick={() => !isLocked && setJobTypeByStruct({ ...jobTypeByStruct, [activeStructKey]: jt })}
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
                                        const isLocked = isClosed || structureStatus[activeStructKey]?.status === "CLOSED";
                                        return (
                                          <Badge
                                            key={idVal}
                                            variant={isSelected ? "default" : "secondary"}
                                            className={cn("border select-none transition-colors px-3 py-1",
                                              isLocked ? "opacity-50 cursor-not-allowed pointer-events-none" : "cursor-pointer",
                                              isSelected ? "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800")}
                                            onClick={() => {
                                              if (isLocked) return;
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

                          </div>

                          <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-slate-950">
                            <Tabs value={inspectionModeTab} onValueChange={setInspectionModeTab} className="w-full">
                              <TabsList className="grid w-full grid-cols-2 mb-4">
                                <TabsTrigger value="diving" className="text-xs font-bold uppercase">Diving</TabsTrigger>
                                <TabsTrigger value="rov" className="text-xs font-bold uppercase">ROV</TabsTrigger>
                              </TabsList>

                              <TabsContent value="diving" className="space-y-4">
                                <div className="relative">
                                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                  <Input
                                    placeholder="Search diving inspection types..."
                                    className="h-9 pl-9 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    value={inspectionSearch}
                                    onChange={(e) => setInspectionSearch(e.target.value)}
                                  />
                                </div>
                                {inspectionSearch && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {inspectionTypes?.data?.filter((insp: any) => {
                                      // Diving filter
                                      const isDiving = insp.metadata?.diving === 1 || insp.metadata?.diving === "1" || insp.metadata?.diving === true;
                                      if (!isDiving) return false;

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
                                      const isLocked = isClosed || structureStatus[activeStructKey]?.status === "CLOSED";
                                      return (
                                        <div
                                          key={insp.id}
                                          className={cn(
                                            "flex items-start gap-3 p-3 rounded-xl border transition-all",
                                            isLocked ? "opacity-60 cursor-not-allowed" : "",
                                            isSelected
                                              ? "bg-amber-50 dark:bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10"
                                              : "bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700"
                                          )}
                                        >
                                          <div className="flex flex-col flex-1 min-w-0">
                                            <span className={cn("font-bold text-xs truncate", isSelected ? "text-amber-900 dark:text-amber-100" : "text-slate-700 dark:text-slate-200")}>{insp.name}</span>
                                            <span className="text-[10px] font-mono text-slate-400 mt-0.5">{insp.code}</span>
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className={cn(
                                              "h-6 text-[10px] uppercase font-bold shrink-0",
                                              isSelected
                                                ? "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/20"
                                                : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                            )}
                                            onClick={() => !isLocked && toggleInspection(insp)}
                                            disabled={isLocked}
                                          >
                                            {isSelected ? "Added" : "Add"}
                                          </Button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </TabsContent>

                              <TabsContent value="rov" className="space-y-4">
                                <div className="relative">
                                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                                  <Input
                                    placeholder="Search ROV inspection types..."
                                    className="h-9 pl-9 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                    value={inspectionSearch}
                                    onChange={(e) => setInspectionSearch(e.target.value)}
                                  />
                                </div>
                                {inspectionSearch && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {inspectionTypes?.data?.filter((insp: any) => {
                                      // ROV filter
                                      const isROV = insp.metadata?.rov === 1 || insp.metadata?.rov === "1" || insp.metadata?.rov === true;
                                      if (!isROV) return false;

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
                                      const isLocked = isClosed || structureStatus[activeStructKey]?.status === "CLOSED";
                                      return (
                                        <div
                                          key={insp.id}
                                          className={cn(
                                            "flex items-start gap-3 p-3 rounded-xl border transition-all",
                                            isLocked ? "opacity-60 cursor-not-allowed" : "",
                                            isSelected
                                              ? "bg-sky-50 dark:bg-sky-500/10 border-sky-500 shadow-lg shadow-sky-500/10"
                                              : "bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-700"
                                          )}
                                        >
                                          <div className="flex flex-col flex-1 min-w-0">
                                            <span className={cn("font-bold text-xs truncate", isSelected ? "text-sky-900 dark:text-sky-100" : "text-slate-700 dark:text-slate-200")}>{insp.name}</span>
                                            <span className="text-[10px] font-mono text-slate-400 mt-0.5">{insp.code}</span>
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className={cn(
                                              "h-6 text-[10px] uppercase font-bold shrink-0",
                                              isSelected
                                                ? "text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-500/20"
                                                : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                            )}
                                            onClick={() => !isLocked && toggleInspection(insp)}
                                            disabled={isLocked}
                                          >
                                            {isSelected ? "Added" : "Add"}
                                          </Button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </TabsContent>
                            </Tabs>
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

      {/* SOW Dialog */}
      {sowStructure && sowDialogOpen && (
        <SOWDialog
          open={sowDialogOpen}
          onOpenChange={setSOWDialogOpen}
          jobpackId={Number(id)}
          jobpackTitle={data?.data?.name}
          structure={{
            id: sowStructure.id,
            type: sowStructure.type,
            title: sowStructure.title,
          }}
          availableStructures={selectedStructures || []}
          onSwitchStructure={(newStruct) => setSOWStructure(newStruct)}
          inspectionTypes={inspectionsByStruct[`${sowStructure.type}-${sowStructure.id}`] || []}
          components={sowComponents}
          onSave={() => {
            // Optionally refresh data
            setSOWDialogOpen(false);
          }}
          readOnly={
            data?.data?.status === "CLOSED" ||
            structureStatus?.[`${sowStructure.type}-${sowStructure.id}`]?.status === "CLOSED"
          }
        />
      )}

    </div>
  );
}
