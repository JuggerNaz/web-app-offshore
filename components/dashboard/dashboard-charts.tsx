"use client";

import dynamic from "next/dynamic";
import * as React from "react";

// Dynamically import charts with SSR disabled to prevent hydration issues
const AnomalyTrendChart = dynamic(() => import("@/components/charts/anomaly-trend-chart").then(mod => mod.AnomalyTrendChart), { ssr: false });
const AnodeTrendChart = dynamic(() => import("@/components/charts/anode-trend-chart").then(mod => mod.AnodeTrendChart), { ssr: false });
const CPTrendChart = dynamic(() => import("@/components/charts/cp-trend-chart").then(mod => mod.CPTrendChart), { ssr: false });
const MarineGrowthChart = dynamic(() => import("@/components/charts/marine-growth-chart").then(mod => mod.MarineGrowthChart), { ssr: false });
const ScourTrendChart = dynamic(() => import("@/components/charts/scour-trend-chart").then(mod => mod.ScourTrendChart), { ssr: false });

export function DashboardCharts() {
  const [mounted, setMounted] = React.useState(false);
  
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-[350px] rounded-2xl bg-slate-100 dark:bg-slate-900 animate-pulse border border-slate-200 dark:border-slate-800" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-100 pb-10">
      <AnomalyTrendChart />
      <AnodeTrendChart />
      <CPTrendChart />
      <MarineGrowthChart />
      <ScourTrendChart />
    </div>
  );
}
