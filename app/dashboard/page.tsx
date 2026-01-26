import { LayoutDashboard, ShieldCheck, Activity, AlertTriangle, FileText } from "lucide-react";
import { CPTrendChart } from "@/components/charts/cp-trend-chart";
import { AnodeTrendChart } from "@/components/charts/anode-trend-chart";
import { MarineGrowthChart } from "@/components/charts/marine-growth-chart";
import { ScourTrendChart } from "@/components/charts/scour-trend-chart";
import { AnomalyTrendChart } from "@/components/charts/anomaly-trend-chart";

export default async function DashboardPage() {
  return (
    <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/30 dark:bg-transparent animate-in fade-in duration-700">
      <div className="max-w-7xl mx-auto w-full p-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 text-white dark:text-slate-900 flex items-center justify-center shadow-lg">
              <LayoutDashboard className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">
                <span className="opacity-50">Intelligent</span>
                <div className="h-1 w-1 rounded-full bg-blue-500" />
                <span className="text-slate-900 dark:text-white/80">Command Centre</span>
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Global Asset Analytics</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Live Status: Stable</span>
            </div>
          </div>
        </div>

        {/* Quick Stats / Summary Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {[
            { label: "Asset Health", value: "94.2%", icon: ShieldCheck, color: "text-emerald-500" },
            { label: "Active Nodes", value: "1,248", icon: Activity, color: "text-blue-500" },
            { label: "Pending Fixes", value: "15", icon: AlertTriangle, color: "text-amber-500" },
            { label: "Recent Reports", value: "8", icon: FileText, color: "text-purple-500" },
          ].map((stat, i) => (
            <div key={i} className="p-4 rounded-2xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`h-5 w-5 ${stat.color} opacity-80 group-hover:scale-110 transition-transform`} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">Realtime</span>
              </div>
              <div className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">{stat.value}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Analytics Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-100 pb-10">
          <AnomalyTrendChart />
          <AnodeTrendChart />
          <CPTrendChart />
          <MarineGrowthChart />
          <ScourTrendChart />
        </div>
      </div>
    </div>
  );
}
