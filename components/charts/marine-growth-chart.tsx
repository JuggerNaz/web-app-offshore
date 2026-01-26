"use client";

import { Waves } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
    { year: "2019", thickness: 15 },
    { year: "2020", thickness: 22 },
    { year: "2021", thickness: 35 },
    { year: "2022", thickness: 48 },
    { year: "2023", thickness: 62 },
    { year: "2024", thickness: 75 },
];

const chartConfig = {
    thickness: {
        label: "Thickness (mm)",
        color: "hsl(var(--chart-3))",
    },
} satisfies ChartConfig;

export function MarineGrowthChart() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Marine Growth</CardTitle>
                <CardDescription>Accumulated Thickness Trend</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig}>
                    <AreaChart
                        accessibilityLayer
                        data={chartData}
                        margin={{
                            left: 12,
                            right: 12,
                        }}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="year"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                        />
                        <YAxis hide />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Area
                            dataKey="thickness"
                            type="step"
                            fill="var(--color-thickness)"
                            fillOpacity={0.4}
                            stroke="var(--color-thickness)"
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col items-start gap-2 text-sm">
                <div className="flex gap-2 font-medium leading-none">
                    Consistent growth rate observed <Waves className="h-4 w-4" />
                </div>
                <div className="leading-none text-muted-foreground">
                    Average thickness across all structural members
                </div>
            </CardFooter>
        </Card>
    );
}
