"use client";

import { TrendingDown } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

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
    { year: "2019", cp: -1.05 },
    { year: "2020", cp: -1.02 },
    { year: "2021", cp: -0.98 },
    { year: "2022", cp: -0.95 },
    { year: "2023", cp: -0.92 },
    { year: "2024", cp: -0.89 },
];

const chartConfig = {
    cp: {
        label: "CP Value (V)",
        color: "hsl(var(--chart-2))",
    },
} satisfies ChartConfig;

export function CPTrendChart() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>CP Trending</CardTitle>
                <CardDescription>Average CP Potential (mV) per Year</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig}>
                    <LineChart
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
                        <YAxis
                            domain={[-1.2, -0.7]}
                            tickLine={false}
                            axisLine={false}
                            hide
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Line
                            dataKey="cp"
                            type="natural"
                            stroke="var(--color-cp)"
                            strokeWidth={2}
                            dot={{
                                fill: "var(--color-cp)",
                            }}
                            activeDot={{
                                r: 6,
                            }}
                        />
                    </LineChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col items-start gap-2 text-sm">
                <div className="flex gap-2 font-medium leading-none">
                    Potential trend approaching threshold <TrendingDown className="h-4 w-4" />
                </div>
                <div className="leading-none text-muted-foreground">
                    Showing data for the last 6 years
                </div>
            </CardFooter>
        </Card>
    );
}
