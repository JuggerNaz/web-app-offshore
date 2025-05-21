import { AreaChartStacked } from "@/components/charts/area-chart-stacked";
import { BarChartMultiple } from "@/components/charts/bar-chart-multiple";
import { DonutPieChart } from "@/components/charts/donut-pie-chart";
import { InteractiveAreaChart } from "@/components/charts/interactive-area-chart";

export default async function DashboardPage() { 
  return (
    <div className="flex-1 w-full flex flex-col gap-12">
      <div className="flex flex-col gap-5 items-start">
       
        <div className="flex gap-5">
          <AreaChartStacked />
          <BarChartMultiple />
          <DonutPieChart />
        </div>
        <InteractiveAreaChart />
      </div>
    </div>
  );
}
