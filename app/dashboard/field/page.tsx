"use client";
import { fields } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";

export default function FieldPage() {
    const { data, error, isLoading } = useSWR("/api/library/OILFIELD", fetcher);

    if (error) return <div>failed to load</div>;
    if (isLoading) return <div>loading...</div>;

    return (
        <div className="flex-1 w-full flex flex-col gap-4 p-4">
            <div className="">
                {data ? <DataTable columns={fields} data={data.data} /> : <div>Loading...</div>}
            </div>
        </div>
    );
}
