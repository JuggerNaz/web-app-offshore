"use client";
import { pipelines } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { useSearchParams } from "next/navigation";
import { FileText, Activity, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PipelinePage() {
  const { data, error, isLoading } = useSWR("/api/pipeline", fetcher);
  const searchParams = useSearchParams();
  const field = searchParams.get("field");

  if (error) return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl mb-4 text-red-500">
        <Activity className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-black tracking-tight mb-2">Sync Error</h2>
      <p className="text-slate-500 max-w-xs mx-auto mb-6">Failed to retrieve pipeline data. Please check your connection.</p>
      <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl px-8 font-bold">Retry</Button>
    </div>
  );

  if (isLoading) return (
    <div className="flex-1 flex flex-col items-center justify-center p-20 space-y-4">
      <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Synchronizing Pipeline Network...</p>
    </div>
  );

  return (
    <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/30 dark:bg-transparent animate-in fade-in duration-700">
      <div className="max-w-7xl mx-auto w-full p-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <FileText className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                <span className="opacity-50">Operational</span>
                <div className="h-1 w-1 rounded-full bg-blue-500" />
                <span className="text-blue-600/80">Asset Class</span>
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Pipeline Network</h1>
            </div>
          </div>

          <Button asChild className="rounded-xl h-12 px-6 font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl hover:opacity-90 transition-all gap-2">
            <Link href="/dashboard/field/pipeline/new">
              <Plus className="h-4 w-4" />
              Register Pipeline
            </Link>
          </Button>
        </div>

        {/* Data Table Container */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <DataTable
            columns={pipelines}
            data={data?.data || []}
            initialColumnFilters={field ? [{ id: "pfield", value: field }] : []}
          />
        </div>
      </div>
    </div>
  );
}
