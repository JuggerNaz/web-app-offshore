"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import Link from "next/link";
import moment from "moment";
import { 
  Package, 
  Activity, 
  Plus, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Calendar, 
  Building2, 
  CheckCircle,
  FileSpreadsheet,
  AlertCircle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { JobpackActions } from "@/components/data-table/columns";

export default function JobpackPage() {
  const { data, error, isLoading } = useSWR("/api/jobpack", fetcher);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({});

  // Auto-expand all years by default once data loads
  useEffect(() => {
    if (data?.data) {
      const years = new Set<string>();
      data.data.forEach((jp: any) => {
        const istart = jp.metadata?.istart;
        let year = "Unknown";
        if (istart) {
          const parsed = new Date(istart).getFullYear();
          if (!isNaN(parsed)) year = parsed.toString();
        }
        years.add(year);
      });
      const initial: Record<string, boolean> = {};
      years.forEach((y) => {
        initial[y] = true;
      });
      setExpandedYears(initial);
    }
  }, [data?.data]);

  if (error) return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl mb-4 text-red-500">
        <Activity className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-black tracking-tight mb-2">Sync Error</h2>
      <p className="text-slate-500 max-w-xs mx-auto mb-6">Failed to retrieve jobpack inventory. Please check your connection.</p>
      <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl px-8 font-bold">Retry</Button>
    </div>
  );

  if (isLoading) return (
    <div className="flex-1 flex flex-col items-center justify-center p-20 space-y-4">
      <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Work Packages...</p>
    </div>
  );

  const jobpackList = data?.data || [];

  // Filter jobpacks based on search query
  const filteredJobpacks = jobpackList.filter((jp: any) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = (jp.name || "").toLowerCase();
    const plan = ((jp.metadata as any)?.plantype || "").toLowerCase();
    const task = ((jp.metadata as any)?.tasktype || "").toLowerCase();
    const start = ((jp.metadata as any)?.istart || "").toLowerCase();
    const year = start ? new Date(start).getFullYear().toString() : "unknown";
    const structures = ((jp.metadata as any)?.structures || []).some((s: any) => 
      (s.title || "").toLowerCase().includes(query) ||
      (s.name || "").toLowerCase().includes(query) ||
      (s.code || "").toLowerCase().includes(query)
    );
    return name.includes(query) || plan.includes(query) || task.includes(query) || start.includes(query) || year.includes(query) || structures;
  });

  // Calculate top level overall statistics (all matching search)
  const totalCount = filteredJobpacks.length;
  const openCount = filteredJobpacks.filter((jp: any) => jp.status === "OPEN").length;
  const closedCount = filteredJobpacks.filter((jp: any) => jp.status === "CLOSED").length;

  // Group by year of start date
  const groupedByYear: Record<string, any[]> = {};
  filteredJobpacks.forEach((jp: any) => {
    const istart = (jp.metadata as any)?.istart;
    let year = "Unknown";
    if (istart) {
      const parsed = new Date(istart).getFullYear();
      if (!isNaN(parsed)) {
        year = parsed.toString();
      }
    }
    if (!groupedByYear[year]) {
      groupedByYear[year] = [];
    }
    groupedByYear[year].push(jp);
  });

  // Sort first level: descending order of years (Unknown last)
  const sortedYears = Object.keys(groupedByYear).sort((a, b) => {
    if (a === "Unknown") return 1;
    if (b === "Unknown") return -1;
    return b.localeCompare(a); // desc order
  });

  // Sort second level: sort by jobpack name and start date
  sortedYears.forEach((year) => {
    groupedByYear[year].sort((a, b) => {
      // 1. Sort by Jobpack Name (lexicographical, ascending)
      const nameA = (a.name || "").toLowerCase();
      const nameB = (b.name || "").toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;

      // 2. Sort by Start Date (chronological, ascending/descending)
      const dateA = (a.metadata as any)?.istart || "";
      const dateB = (b.metadata as any)?.istart || "";
      return dateA.localeCompare(dateB);
    });
  });

  const toggleYear = (year: string) => {
    setExpandedYears((prev) => ({
      ...prev,
      [year]: !prev[year],
    }));
  };

  return (
    <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/30 dark:bg-transparent animate-in fade-in duration-700">
      <div className="max-w-full mx-auto w-full p-8 space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Package className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                <span className="opacity-50">Operational</span>
                <div className="h-1 w-1 rounded-full bg-blue-500" />
                <span className="text-blue-600/80">Fleet Execution</span>
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Jobpacks & Work Units</h1>
            </div>
          </div>

          {/* Action and Refresh Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className="rounded-xl h-12 px-6 font-bold border-slate-200 dark:border-slate-800"
              onClick={() => window.location.reload()}
            >
              Refresh
            </Button>
            <Link href="/dashboard/jobpack/new">
              <Button
                className="rounded-xl h-12 px-8 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20 transition-all gap-2"
              >
                <Plus className="h-4 w-4" />
                Register New Job Pack
              </Button>
            </Link>
          </div>
        </div>

        {/* Toolbar & Global Stats */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-center">
          {/* Search Box */}
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search jobpack, type, structure, year..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-12 rounded-2xl bg-slate-50 dark:bg-slate-950 border-slate-200/80 dark:border-slate-800 font-medium placeholder:text-slate-400"
            />
          </div>

          {/* Stats Badges */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex flex-wrap gap-2 text-xs">
              <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <span>Total:</span>
                <span className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-md font-extrabold">{totalCount}</span>
              </div>
              <div className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <span>Open:</span>
                <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-md font-extrabold">{openCount}</span>
              </div>
              <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>Closed:</span>
                <span className="bg-slate-200 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-extrabold">{closedCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Year Groups List */}
        <div className="space-y-6">
          {sortedYears.length > 0 ? (
            sortedYears.map((year) => {
              const yearJobpacks = groupedByYear[year];
              const isExpanded = !!expandedYears[year];

              // Calculate year unique structures
              const uniqueStructures = new Set<string>();
              yearJobpacks.forEach((jp: any) => {
                const structures = (jp.metadata as any)?.structures || [];
                structures.forEach((s: any) => {
                  if (s.id) uniqueStructures.add(`${s.type}-${s.id}`);
                });
              });
              const structuresCount = uniqueStructures.size;

              // Calculate year open/closed stats
              const yearOpen = yearJobpacks.filter((jp: any) => jp.status === "OPEN").length;
              const yearClosed = yearJobpacks.filter((jp: any) => jp.status === "CLOSED").length;

              return (
                <div 
                  key={year}
                  className="bg-white dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/80 rounded-3xl overflow-hidden shadow-sm transition-all duration-300"
                >
                  {/* Collapsible Header */}
                  <div
                    onClick={() => toggleYear(year)}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/20 select-none transition-colors border-b border-slate-50 dark:border-slate-800/50"
                  >
                    <div className="flex items-center gap-4">
                      {/* Chevron Indicator */}
                      <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-500 flex items-center justify-center transition-transform duration-300">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                      
                      {/* Year Title */}
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                          {year === "Unknown" ? "Unknown Year" : year}
                        </span>
                        <span className="text-xs uppercase font-extrabold tracking-widest text-slate-400">
                          Operations
                        </span>
                      </div>
                    </div>

                    {/* Metadata Summary Info Block */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Jobpack Count Pill */}
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full">
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        <span>{yearJobpacks.length} Jobpacks</span>
                      </div>

                      {/* Unique Structures Pill */}
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100/50 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-full">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{structuresCount} {structuresCount === 1 ? "Structure" : "Structures"}</span>
                      </div>

                      {/* Open / Closed Status Pill */}
                      <div className="flex items-center gap-3 px-3 py-1 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-full">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span>{yearOpen} Open</span>
                        </div>
                        <span className="text-slate-300">|</span>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-slate-400" />
                          <span>{yearClosed} Closed</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Content */}
                  <div
                    className={`transition-all duration-300 ease-in-out ${
                      isExpanded ? "block opacity-100" : "hidden opacity-0"
                    }`}
                  >
                    <div className="p-1">
                      <Table>
                        <TableHeader className="bg-slate-50/50 dark:bg-slate-900/80">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-16">ID</TableHead>
                            <TableHead className="min-w-[200px]">Name</TableHead>
                            <TableHead className="w-32">Plan Type</TableHead>
                            <TableHead className="w-32">Task Type</TableHead>
                            <TableHead className="w-28">Status</TableHead>
                            <TableHead>Structures Involved</TableHead>
                            <TableHead className="w-36">Start Date</TableHead>
                            <TableHead className="w-24 text-center">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {yearJobpacks.map((jp: any) => {
                            const metadata = jp.metadata || {};
                            const structures = metadata.structures || [];
                            const stStatus = metadata.structure_status || {};
                            const plantype = metadata.plantype;
                            const tasktype = metadata.tasktype;
                            const start = metadata.istart;

                            let statusColor = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
                            if (jp.status === "OPEN") {
                              statusColor = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/20";
                            } else if (jp.status === "CLOSED") {
                              statusColor = "bg-slate-100 text-slate-400 line-through dark:bg-slate-800/50 dark:text-slate-500";
                            }

                            return (
                              <TableRow 
                                key={jp.id}
                                className="group hover:bg-slate-50/40 dark:hover:bg-slate-800/10 transition-colors"
                              >
                                {/* ID */}
                                <TableCell className="font-mono text-xs text-slate-400 dark:text-slate-500">
                                  #{jp.id}
                                </TableCell>
                                
                                {/* Name */}
                                <TableCell className="font-semibold text-slate-900 dark:text-white">
                                  {jp.name || <span className="text-slate-400 italic">No Name</span>}
                                </TableCell>
                                
                                {/* Plan Type */}
                                <TableCell>
                                  {plantype ? (
                                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                                      {plantype}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 text-xs">-</span>
                                  )}
                                </TableCell>

                                {/* Task Type */}
                                <TableCell>
                                  {tasktype ? (
                                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                                      {tasktype}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300 text-xs">-</span>
                                  )}
                                </TableCell>

                                {/* Status */}
                                <TableCell>
                                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase ${statusColor}`}>
                                    {jp.status}
                                  </span>
                                </TableCell>

                                {/* Structures */}
                                <TableCell>
                                  {structures.length === 0 ? (
                                    <span className="text-slate-400 text-xs italic">No structures assigned</span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                      {structures.map((s: any, i: number) => {
                                        const key = `${s.type}-${s.id}`;
                                        const isClosed = stStatus[key]?.status === "CLOSED";

                                        return (
                                          <Badge 
                                            key={i} 
                                            variant="outline"
                                            className={`text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1.5 transition-colors ${
                                              isClosed
                                                ? "bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800/40 dark:text-slate-500 dark:border-slate-800"
                                                : "bg-indigo-50/50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/60"
                                            }`}
                                          >
                                            {s.title || s.code || s.name}
                                            {isClosed && <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-500" />}
                                          </Badge>
                                        );
                                      })}
                                    </div>
                                  )}
                                </TableCell>

                                {/* Start Date */}
                                <TableCell className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                  {start ? (
                                    <div className="flex items-center gap-1.5">
                                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                      <span>{moment(start).format("DD MMM YYYY")}</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 text-xs">N/A</span>
                                  )}
                                </TableCell>

                                {/* Actions */}
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <div className="flex justify-center">
                                    <JobpackActions row={{ original: jp }} />
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center p-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2rem] bg-white dark:bg-slate-900/20">
              <AlertCircle className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-3" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Jobpacks Found</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mt-1">
                We couldn't find any jobpacks matching "{searchQuery}". Try adjusting your keywords or clearing the search.
              </p>
              {searchQuery && (
                <Button 
                  onClick={() => setSearchQuery("")} 
                  variant="outline" 
                  className="mt-4 rounded-xl text-xs font-bold"
                >
                  Clear Search
                </Button>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
