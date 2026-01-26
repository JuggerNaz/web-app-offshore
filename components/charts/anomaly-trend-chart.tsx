"use client";

import { CheckCircle2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";

const chartData = [
    { year: "2021", open: 12, closed: 45 },
    { year: "2022", open: 18, closed: 52 },
    { year: "2023", open: 25, closed: 48 },
    { year: "2024", open: 15, closed: 60 },
];

const chartConfig = {
    open: {
        label: "Open Anomalies",
        color: "hsl(var(--destructive))",
    },
    closed: {
        label: "Closed Anomalies",
        color: "hsl(var(--chart-2))",
    },
} satisfies ChartConfig;

export function AnomalyTrendChart() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Anomaly Trend</CardTitle>
                <CardDescription>Historical Anomaly Status Distribution</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig}>
                    <BarChart accessibilityLayer data={chartData}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="year"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="dashed" />}
                        />
                        <Bar dataKey="open" fill="var(--color-open)" radius={4} stackId="a" />
                        <Bar dataKey="closed" fill="var(--color-closed)" radius={4} stackId="a" />
                    </BarChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col items-start gap-2 text-sm">
                <div className="flex gap-2 font-medium leading-none text-emerald-600">
                    Closer rate increased by 20% in 2024 <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="leading-none text-muted-foreground">
                    Total anomalies registered vs rectified
                </div>
            </CardFooter>
        </Card>
    );
}
