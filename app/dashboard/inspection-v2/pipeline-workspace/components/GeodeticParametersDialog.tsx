"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, Save, Loader2, Database, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

export interface GeodeticData {
  geo_proj_nam: string;
  geo_units: string;
  geo_datum: string;
  geo_elli_sph: string;
  geo_dir: string;
  geo_dx: number;
  geo_dy: number;
  geo_dz: number;
}

interface GeodeticParametersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobpackId?: string | number | null;
  structureId?: string | number | null;
  jobpackName?: string;
  onSaveSuccess?: (data: GeodeticData) => void;
}

export function GeodeticParametersDialog({
  open,
  onOpenChange,
  jobpackId,
  structureId,
  jobpackName = "",
  onSaveSuccess
}: GeodeticParametersDialogProps) {
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCustomJobpackData, setIsCustomJobpackData] = useState(false);

  const [formData, setFormData] = useState<GeodeticData>({
    geo_proj_nam: "Timbalai 1948 RSO Borneo Feet (BRS0)",
    geo_units: "Meters",
    geo_datum: "Timbalai 1948",
    geo_elli_sph: "Everest 1830 (1967 Definition)",
    geo_dir: "WGS-84 To Timbalai",
    geo_dx: 533.4,
    geo_dy: -669.2,
    geo_dz: 52.5
  });

  useEffect(() => {
    if (open) {
      loadGeodeticData();
    }
  }, [open, jobpackId, structureId]);

  const loadGeodeticData = async () => {
    setLoading(true);
    setIsCustomJobpackData(false);
    try {
      let loadedFromJobpack = false;

      // 1. Check if jobpack has saved geodetic_parameters in metadata
      if (jobpackId) {
        const jId = Number(jobpackId);
        if (!isNaN(jId)) {
          const { data: jpData } = await supabase
            .from("jobpack")
            .select("metadata")
            .eq("id", jId)
            .maybeSingle();

          const jpMeta = jpData?.metadata as any;
          if (jpMeta?.geodetic_parameters) {
            setFormData({
              geo_proj_nam: jpMeta.geodetic_parameters.geo_proj_nam || jpMeta.geodetic_parameters.geo_proj_nam || "",
              geo_units: jpMeta.geodetic_parameters.geo_units || "Meters",
              geo_datum: jpMeta.geodetic_parameters.geo_datum || "",
              geo_elli_sph: jpMeta.geodetic_parameters.geo_elli_sph || "",
              geo_dir: jpMeta.geodetic_parameters.geo_dir || "",
              geo_dx: Number(jpMeta.geodetic_parameters.geo_dx ?? 0),
              geo_dy: Number(jpMeta.geodetic_parameters.geo_dy ?? 0),
              geo_dz: Number(jpMeta.geodetic_parameters.geo_dz ?? 0),
            });
            setIsCustomJobpackData(true);
            loadedFromJobpack = true;
          }
        }
      }

      // 2. If not saved on jobpack, fetch defaults from Pipeline Spec (u_pipegeo)
      if (!loadedFromJobpack && structureId) {
        const cleanStrId = typeof structureId === "string" && structureId.includes("-")
          ? structureId.split("-")[1]
          : String(structureId);

        const sId = Number(cleanStrId);
        if (!isNaN(sId)) {
          const { data: pipeGeo } = await supabase
            .from("u_pipegeo")
            .select("*")
            .eq("str_id", sId)
            .maybeSingle();

          if (pipeGeo) {
            setFormData({
              geo_proj_nam: pipeGeo.geo_proj_nam || "Timbalai 1948 RSO Borneo Feet (BRS0)",
              geo_units: pipeGeo.geo_units || "Meters",
              geo_datum: pipeGeo.geo_datum || "Timbalai 1948",
              geo_elli_sph: pipeGeo.geo_elli_sph || "Everest 1830 (1967 Definition)",
              geo_dir: pipeGeo.geo_dir || "WGS-84 To Timbalai",
              geo_dx: Number(pipeGeo.geo_dx ?? 533.4),
              geo_dy: Number(pipeGeo.geo_dy ?? -669.2),
              geo_dz: Number(pipeGeo.geo_dz ?? 52.5),
            });
          }
        }
      }
    } catch (err) {
      console.error("Error loading geodetic parameters:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!jobpackId) {
      toast.error("Please select a JobPack before saving Geodetic Data.");
      return;
    }

    setSaving(true);
    try {
      const jId = Number(jobpackId);
      // Fetch existing jobpack metadata
      const { data: jpData, error: fetchErr } = await supabase
        .from("jobpack")
        .select("metadata")
        .eq("id", jId)
        .single();

      if (fetchErr) throw fetchErr;

      const existingMeta = (jpData?.metadata as any) || {};
      const updatedMeta = {
        ...existingMeta,
        geodetic_parameters: {
          ...formData,
          updated_at: new Date().toISOString()
        }
      };

      const { error: updateErr } = await supabase
        .from("jobpack")
        .update({ metadata: updatedMeta })
        .eq("id", jId);

      if (updateErr) throw updateErr;

      setIsCustomJobpackData(true);
      toast.success(`Geodetic parameters saved for Jobpack ${jobpackName || jId}`);
      if (onSaveSuccess) onSaveSuccess(formData);
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error saving geodetic parameters:", err);
      toast.error(`Failed to save geodetic parameters: ${err.message || "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  Geodetic Parameters
                  {isCustomJobpackData && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      JobPack Overridden
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-0.5">
                  Global Positioning & Survey Reference {jobpackName ? `• ${jobpackName}` : ""}
                </DialogDescription>
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || loading}
              className="rounded-xl h-11 px-6 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 transition-all gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Save Geodetic Data</span>
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center p-16 space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Geodetic Parameters...</p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Grid layout matching screenshot */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Column 1: Project Identity & Reference System */}
              <div className="md:col-span-8 space-y-6">
                
                {/* Project Identity */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                    Project Identity
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Projection Name</Label>
                      <Input
                        value={formData.geo_proj_nam}
                        onChange={(e) => setFormData({ ...formData, geo_proj_nam: e.target.value })}
                        placeholder="Projection Name"
                        className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-semibold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Units</Label>
                      <Select
                        value={formData.geo_units}
                        onValueChange={(val) => setFormData({ ...formData, geo_units: val })}
                      >
                        <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-semibold">
                          <SelectValue placeholder="Select Units" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Meters">Meters</SelectItem>
                          <SelectItem value="Feet">Feet</SelectItem>
                          <SelectItem value="US Survey Feet">US Survey Feet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Reference System */}
                <div className="space-y-4 pt-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
                    Reference System
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Datum</Label>
                      <Input
                        value={formData.geo_datum}
                        onChange={(e) => setFormData({ ...formData, geo_datum: e.target.value })}
                        placeholder="Datum"
                        className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-semibold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Ellipsoid / Spheroid</Label>
                      <Input
                        value={formData.geo_elli_sph}
                        onChange={(e) => setFormData({ ...formData, geo_elli_sph: e.target.value })}
                        placeholder="Ellipsoid / Spheroid"
                        className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-semibold"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Datum Shift</Label>
                      <Input
                        value={formData.geo_dir}
                        onChange={(e) => setFormData({ ...formData, geo_dir: e.target.value })}
                        placeholder="Datum Shift (e.g. WGS-84 To Timbalai)"
                        className="h-10 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-semibold"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Column 2: Translation (m) Panel */}
              <div className="md:col-span-4 p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-850 space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-4">
                    Translation (m)
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-xs font-bold text-slate-600 dark:text-slate-400">Dx</span>
                      <Input
                        type="number"
                        step="any"
                        value={formData.geo_dx}
                        onChange={(e) => setFormData({ ...formData, geo_dx: parseFloat(e.target.value) || 0 })}
                        className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-right"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="w-8 text-xs font-bold text-slate-600 dark:text-slate-400">Dy</span>
                      <Input
                        type="number"
                        step="any"
                        value={formData.geo_dy}
                        onChange={(e) => setFormData({ ...formData, geo_dy: parseFloat(e.target.value) || 0 })}
                        className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-right"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="w-8 text-xs font-bold text-slate-600 dark:text-slate-400">Dz</span>
                      <Input
                        type="number"
                        step="any"
                        value={formData.geo_dz}
                        onChange={(e) => setFormData({ ...formData, geo_dz: parseFloat(e.target.value) || 0 })}
                        className="h-10 rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-right"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-[10px] text-blue-900 dark:text-blue-300 font-medium">
                  💡 Saved geodetic parameters apply strictly to the selected JobPack and will automatically print as the header on Video/Event Log reports.
                </div>
              </div>

            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
