'use client'
import { jobpacks } from "@/components/data-table/columns"
import { DataTable } from "@/components/data-table/data-table"
import useSWR from "swr"
import { fetcher } from "@/utils/utils"

export default function PipelinePage() {
  const { data, error, isLoading } = useSWR('/api/jobpack', fetcher)

  if (error) return <div>failed to load</div>
  if (isLoading) return <div>loading...</div>

  return (
    <div className="flex-1 w-full flex flex-col">
      <div className="flex flex-col items-start">
        <h2 className="font-bold text-2xl">Jobpack</h2>
      </div>
      <div className="container mx-auto py-10">
        {
          data ? <DataTable columns={jobpacks} data={data.data} /> : <div>Loading...</div>
        }
      </div>
    </div>
  );
}