"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { useParams, useRouter } from "next/navigation";
import { fetcher } from "@/utils/utils";
import {
  Search,
  LayoutGrid,
  List,
  Calendar,
  FileText,
  Activity,
  Boxes,
  Waves,
  Eye,
  Info
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type CompiledJobpack = {
  jobpack_id: number;
  jobpack_name: string;
  year: string;
  job_type: string;
  sow_report_nos: string;
  types_count: number;
  components_inspected_count: number;
  rov_types_count: number;
  diving_types_count: number;
};

export default function InspectionsTab() {
  const { id } = useParams();
  const router = useRouter();
  const platformId = Number(id);

  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

  const { data, error, isLoading } = useSWR<{ data: CompiledJobpack[] }>(
    platformId ? `/api/platform/${platformId}/inspections` : null,
    fetcher
  );

  const jobpacks = data?.data || [];

  // Filter jobpacks based on search query
  const filteredJobpacks = useMemo(() => {
    if (!searchQuery.trim()) return jobpacks;
    const q = searchQuery.toLowerCase();
    return jobpacks.filter(
      (jp) =>
        (jp.jobpack_name || "").toLowerCase().includes(q) ||
        (jp.job_type || "").toLowerCase().includes(q) ||
        (jp.sow_report_nos || "").toLowerCase().includes(q) ||
        (jp.year || "").toLowerCase().includes(q)
    );
  }, [jobpacks, searchQuery]);

  // Navigate to inspection workspace
  const handleDoubleClick = (jobpackId: number) => {
    router.push(`/dashboard/inspection-v2?jobpack=${jobpackId}&structure=${platformId}`);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-slate-900 border rounded-2xl shadow-sm">
        <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-xl mb-3 text-red-500">
          <Activity className="h-6 w-6" />
        </div>
        <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-tight text-sm">Failed to Load Inspections</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
          An error occurred while fetching the inspection data for this platform.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-3 bg-white dark:bg-slate-900 border rounded-2xl shadow-sm">
        <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Inspections...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls panel */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 border rounded-2xl shadow-sm">
        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search jobpacks, types, reports..."
            className="pl-10 h-10 rounded-xl border-slate-200 dark:border-slate-800 text-xs font-semibold focus-visible:ring-blue-500"
          />
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("card")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-1.5 px-3.5 transition-all",
              viewMode === "card"
                ? "bg-white dark:bg-slate-950 text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Card View</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("list")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-1.5 px-3.5 transition-all",
              viewMode === "list"
                ? "bg-white dark:bg-slate-950 text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            <List className="h-3.5 w-3.5" />
            <span>Detail List</span>
          </Button>
        </div>
      </div>

      {filteredJobpacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center bg-white dark:bg-slate-900 border rounded-2xl shadow-sm">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-full mb-3 text-slate-400">
            <Info className="h-8 w-8" />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-white uppercase tracking-tight text-sm">No Jobpacks Found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
            This platform is not involved in any jobpacks matching your criteria.
          </p>
        </div>
      ) : viewMode === "card" ? (
        /* Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobpacks.map((jp) => (
            <Card
              key={jp.jobpack_id}
              onDoubleClick={() => handleDoubleClick(jp.jobpack_id)}
              className="group relative overflow-hidden bg-white dark:bg-slate-900 hover:shadow-xl transition-all duration-300 border border-slate-200/60 dark:border-slate-800/60 hover:border-blue-500/30 rounded-2xl cursor-pointer select-none"
            >
              {/* Sleek top indicator bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-60 group-hover:opacity-100 transition-opacity" />

              <CardContent className="p-5 space-y-4">
                {/* Jobpack name and Year */}
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-600/80 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">
                      {jp.job_type}
                    </span>
                    <h4 className="font-black text-slate-900 dark:text-white text-base tracking-tight leading-snug group-hover:text-blue-600 transition-colors uppercase pt-1">
                      {jp.jobpack_name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-xs font-bold">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>{jp.year}</span>
                  </div>
                </div>

                {/* SOW report number */}
                <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-start gap-2">
                    <FileText className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">SOW Reports</span>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 line-clamp-1">
                        {jp.sow_report_nos}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                  <div className="space-y-1 p-2 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                    <Boxes className="h-4 w-4 mx-auto text-blue-500/80" />
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Components</span>
                    <span className="text-base font-black text-slate-800 dark:text-slate-200">
                      {jp.components_inspected_count}
                    </span>
                  </div>

                  <div className="space-y-1 p-2 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                    <Boxes className="h-4 w-4 mx-auto text-indigo-500/80" />
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Inspection Types</span>
                    <span className="text-base font-black text-slate-800 dark:text-slate-200">
                      {jp.types_count}
                    </span>
                  </div>

                  <div className="space-y-1 p-2 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                    <Activity className="h-4 w-4 mx-auto text-emerald-500/80" />
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">ROV Modes</span>
                    <span className="text-base font-black text-slate-800 dark:text-slate-200">
                      {jp.rov_types_count}
                    </span>
                  </div>

                  <div className="space-y-1 p-2 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                    <Waves className="h-4 w-4 mx-auto text-sky-500/80" />
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Diving Modes</span>
                    <span className="text-base font-black text-slate-800 dark:text-slate-200">
                      {jp.diving_types_count}
                    </span>
                  </div>
                </div>

                {/* Micro-interaction double click helper */}
                <div className="text-[10px] font-bold text-center text-slate-400 group-hover:text-blue-500 transition-colors pt-2 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 duration-300">
                  <Eye className="h-3 w-3" />
                  <span>Double-click to open inspections</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white dark:bg-slate-900 border rounded-2xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/70 dark:bg-slate-800/50">
              <TableRow>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500">Jobpack Name</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 text-center">Year</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500">Job Type</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500">SOW Report No.</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 text-center">Components Inspected</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 text-center">Inspection Types</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 text-center">ROV Types</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 text-center">Diving Types</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobpacks.map((jp) => (
                <TableRow
                  key={jp.jobpack_id}
                  onDoubleClick={() => handleDoubleClick(jp.jobpack_id)}
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer transition-colors duration-200 select-none border-b last:border-0"
                >
                  <TableCell className="font-black text-slate-900 dark:text-white uppercase text-xs">
                    {jp.jobpack_name}
                  </TableCell>
                  <TableCell className="text-center font-bold text-slate-500 text-xs">
                    {jp.year}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-900/20 text-blue-600 border-none">
                      {jp.job_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 font-bold text-xs max-w-xs truncate">
                    {jp.sow_report_nos}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-black text-slate-800 dark:text-slate-200 text-xs">
                      {jp.components_inspected_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-black text-slate-800 dark:text-slate-200 text-xs">
                      {jp.types_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-black text-slate-800 dark:text-slate-200 text-xs">
                      {jp.rov_types_count}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-black text-slate-800 dark:text-slate-200 text-xs">
                      {jp.diving_types_count}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
