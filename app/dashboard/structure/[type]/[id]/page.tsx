"use client"
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import SpecHead from "@/components/forms/spec1";
import { useEffect, useState, Suspense } from "react";
import { useFetchModule } from "@/utils/hooks/module";
import Comments from "@/components/comment/comments";
import Attachments from "@/components/attachment/attachments";

export default function DetailPage() {
    const { type, id } = useParams();
    const [data, setData] = useState<any>()
    
    useEffect(() => {
      const fetchData = async () => {
        let platform = await useFetchModule(Number(id))
        setData(platform.data)
        console.log(platform.data)
      }
      fetchData()
    }, [])
    
    return (
      <div className="flex-1 w-full flex flex-col gap-12">
        <Tabs defaultValue="spec1" className="w-full">
          <TabsList className="w-full justify-items-stretch">
            <TabsTrigger value="spec1">Specification</TabsTrigger>
            <TabsTrigger value="spec2">Specification 2</TabsTrigger>
            <TabsTrigger value="structure-image">Structure Image</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="attachments">Attachment</TabsTrigger>
          </TabsList>
          <TabsContent value="spec1" className="py-2 px-1">
            <Suspense fallback={<Loading />}>
              <SpecHead data={data?.data} />
            </Suspense>
          </TabsContent>
          <TabsContent value="spec2">Content for specification 2</TabsContent>
          <TabsContent value="structure-image">Structure Image</TabsContent>
          <TabsContent value="comments"><Comments /></TabsContent>
          <TabsContent value="attachments"><Attachments /></TabsContent>
        </Tabs>
      </div>
    );
  }

  function Loading() {
    return <h2>🌀 Loading...</h2>;
  }