'use client'
import { columns } from "@/components/data-table/columns"
import { DataTable } from "@/components/data-table/data-table"
import useSWR from "swr"
import { fetcher } from "@/lib/utils"

export default function PlatformPage() {
    
    const { data, error, isLoading } = useSWR('/api/platform', fetcher)

    if (error) return <div>failed to load</div>
    if (isLoading) return <div>loading...</div>

    return (
      <div className="flex-1 w-full flex flex-col">
        <div className="flex flex-col items-start">
          <h2 className="font-bold text-2xl">Platform</h2>
        </div>
        <div className="container mx-auto py-10">
          <DataTable columns={columns} data={data.data} />
        </div>
      </div>
    );
  }