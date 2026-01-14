"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { DataTable } from "@/components/data-table/data-table";
import { inspectionPlanningColumns } from "@/components/data-table/columns";
import { Button } from "@/components/ui/button";
import { Plus, Zap, Activity } from "lucide-react";
import Link from "next/link";

export default function PlanningListPage() {
  const { data, isLoading, error } = useSWR("/api/inspection-planning", fetcher);

  const plans = useMemo(() => data?.data || [], [data]);

  return (
    <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/30 dark:bg-transparent animate-in fade-in duration-700">
      <div className="max-w-[1600px] mx-auto w-full p-8 space-y-8">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
          <div className="flex items-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 text-white dark:text-slate-900 flex items-center justify-center shadow-2xl">
              <Zap className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                <span className="opacity-50">Strategic</span>
                <div className="h-1 w-1 rounded-full bg-blue-500" />
                <span className="text-slate-900 dark:text-white/80">Operational Planning</span>
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Global Planning Dashboard</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard/planning/form">
              <Button className="rounded-xl h-12 px-8 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20 transition-all gap-2">
                <Plus className="h-4 w-4" />
                Register New Plan
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats / Overview Row (Optional but high-end) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: "Active Protocols", value: plans.length, icon: Activity, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
            { label: "Finalized Releases", value: plans.filter((p: any) => p.metadata?.status === 'FINALIZED').length, icon: Zap, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
            { label: "Pending Drafts", value: plans.filter((p: any) => p.metadata?.status === 'DRAFT').length, icon: Plus, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/20" },
          ].map((stat, i) => (
            <div key={i} className="bg-white dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{stat.label}</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white leading-none">{stat.value}</p>
              </div>
              <div className={`h-12 w-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
          ))}
        </div>

        {/* Data Table */}
        <DataTable
          columns={inspectionPlanningColumns}
          data={plans}
          pageSize={10}
          disableRowClick={true}
        />
      </div>
    </div>
  );
}
