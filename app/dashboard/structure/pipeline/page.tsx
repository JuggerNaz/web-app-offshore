'use client'
import { columns } from "@/components/data-table/columns"
import { DataTable } from "@/components/data-table/data-table"
import { useFetchModules  } from "@/utils/hooks/module"
import { useEffect, useState } from "react"

export default function PipelinePage() {
    //TODO: use real type rather than any
    const [data, setData] = useState<any>()
    useEffect(() => {
      const fetchData = async () => {
        let platform = await useFetchModules(1)
        setData(platform.data)
      }
      fetchData()
    }, [])

    return (
      <div className="flex-1 w-full flex flex-col">
        <div className="flex flex-col items-start">
          <h2 className="font-bold text-2xl">Pipeline</h2>
        </div>
        <div className="container mx-auto py-10">
          {
            data ? <DataTable columns={columns} data={data} /> : <div>Loading...</div>
          }
        </div>
      </div>
    );
  }``