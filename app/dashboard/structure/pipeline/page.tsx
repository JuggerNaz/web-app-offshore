'use client'
import { pipelines } from "@/components/data-table/columns"
import { DataTable } from "@/components/data-table/data-table"
import useSWR from "swr"
import { fetcher } from "@/utils/utils"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { PlusCircle } from "lucide-react"

export default function PipelinePage() {
  
  const route = useRouter()
  const { data, error, isLoading } = useSWR('/api/pipeline', fetcher)
  
  if (error) return <div>failed to load</div>
  if (isLoading) return <div>loading...</div>

  return (
    <div className="flex-1 w-full flex flex-col gap-4">
      <div className="flex justify-end">
          <Button 
            type="button" 
            onClick={() => route.push('/dashboard/structure/pipeline/new')}
          >
            <PlusCircle /> New
          </Button>
        </div>
      <div className="">
        {
          data ? <DataTable columns={pipelines} data={data.data} /> : <div>Loading...</div>
        }
      </div>
    </div>
  );
}