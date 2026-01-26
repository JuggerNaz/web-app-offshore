"use client";

import { ArrowUpDown } from "lucide-react";
import { Line, LineChart, CartesianGrid, XAxis, Legend } from "recharts";

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
    { year: "2019", height: 0.5, exposed: 1.2 },
    { year: "2020", height: 0.8, exposed: 1.5 },
    { year: "2021", height: 1.2, exposed: 2.1 },
    { year: "2022", height: 1.1, exposed: 1.8 },
    { year: "2023", height: 1.5, exposed: 2.5 },
    { year: "2024", height: 1.8, exposed: 3.2 },
];

const chartConfig = {
    height: {
        label: "Height (m)",
        color: "hsl(var(--chart-4))",
    },
    exposed: {
        label: "Exposed (m)",
        color: "hsl(var(--chart-5))",
    },
} satisfies ChartConfig;

export function ScourTrendChart() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Scour Trend</CardTitle>
                <CardDescription>Seabed Depth & Exposure Trends</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig}>
                    <LineChart accessibilityLayer data={chartData}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="year"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent />}
                        />
                        <Line
                            dataKey="height"
                            type="monotone"
                            stroke="var(--color-height)"
                            strokeWidth={2}
                            dot={false}
                        />
                        <Line
                            dataKey="exposed"
                            type="monotone"
                            stroke="var(--color-exposed)"
                            strokeWidth={2}
                            dot={false}
                        />
                    </LineChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col items-start gap-2 text-sm">
                <div className="flex gap-2 font-medium leading-none">
                    Recent increase in scour height detected <ArrowUpDown className="h-4 w-4" />
                </div>
                <div className="leading-none text-muted-foreground">
                    Tracking primary foundation members
                </div>
            </CardFooter>
        </Card>
    );
}
