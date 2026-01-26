"use client";

import { AlertCircle } from "lucide-react";
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
    { area: "Zone 1", depletion: 45, missing: 2 },
    { area: "Zone 2", depletion: 32, missing: 0 },
    { area: "Zone 3", depletion: 58, missing: 5 },
    { area: "Zone 4", depletion: 25, missing: 1 },
];

const chartConfig = {
    depletion: {
        label: "Depletion (%)",
        color: "hsl(var(--chart-1))",
    },
    missing: {
        label: "Missing",
        color: "hsl(var(--destructive))",
    },
} satisfies ChartConfig;

export function AnodeTrendChart() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Anode Trend</CardTitle>
                <CardDescription>Depletion Rate vs Missing Count</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig}>
                    <BarChart accessibilityLayer data={chartData}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="area"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="dashed" />}
                        />
                        <Bar dataKey="depletion" fill="var(--color-depletion)" radius={4} />
                        <Bar dataKey="missing" fill="var(--color-missing)" radius={4} />
                    </BarChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col items-start gap-2 text-sm">
                <div className="flex gap-2 font-medium leading-none text-destructive">
                    Zone 3 requires immediate inspection <AlertCircle className="h-4 w-4" />
                </div>
                <div className="leading-none text-muted-foreground">
                    Aggregated by structural zone
                </div>
            </CardFooter>
        </Card>
    );
}
