import { AreaChartStacked } from "@/components/charts/area-chart-stacked";
import { BarChartMultiple } from "@/components/charts/bar-chart-multiple";
import { DonutPieChart } from "@/components/charts/donut-pie-chart";
import { InteractiveAreaChart } from "@/components/charts/interactive-area-chart";
import { LayoutDashboard } from "lucide-react";

export default async function DashboardPage() {
  return (
    <div className="flex-1 w-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/30 dark:bg-transparent animate-in fade-in duration-700">
      <div className="max-w-7xl mx-auto w-full p-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-lg">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-0.5">
                <span className="opacity-50">Enterprise</span>
                <div className="h-1 w-1 rounded-full bg-blue-500" />
                <span className="text-slate-900 dark:text-white/80">Command Centre</span>
              </div>
              <h1 className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">Global Analytics</h1>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <AreaChartStacked />
          <BarChartMultiple />
          <DonutPieChart />
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200">
          <InteractiveAreaChart />
        </div>
      </div>
    </div>
  );
}
