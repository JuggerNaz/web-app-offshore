"use client"
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import SpecHead from "@/components/forms/spec1";
import { useEffect, useState, Suspense } from "react";
import Comments from "@/components/comment/comments";
import Attachments from "@/components/attachment/attachments";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import Spec1Pipeline from "@/components/forms/spec1-pipeline";
import Spec2Platform from "@/components/forms/spec2-platform";
import { Button } from "@/components/ui/button";
import Spec2Pipeline from "@/components/forms/spec2-pipeline";

export default function DetailPage() {
    const { type, id } = useParams();
    const [pageId, setPageId] = useAtom(urlId)
    const [pageType, setPageType] = useAtom(urlType)

    const { data, error, isLoading } = useSWR(`/api/${type}/${id}`, fetcher)

    // useEffect(() => {
    //   setPageId(parseInt(Array.isArray(id) ? id[0] : id))
    //   setPageType(Array.isArray(type) ? type[0] : type)
    // }, [])

    useEffect(() => {
      const resolvedId = Array.isArray(id) ? id[0] : id ?? "0"; // Fallback to "0" if `id` is undefined
      const resolvedType = Array.isArray(type) ? type[0] : type;
    
      setPageId(parseInt(resolvedId));
      setPageType(resolvedType || "platform"); // Provide a fallback for `type` if needed
    }, []);


    // const { data: pipeGeoData, error: errorPipeGeo, isLoading: isLoadingPipeGeo } = useSWR(`/api/pipeline/pipegeo/${pageId}`, fetcher)
    // if (errorPipeGeo) return <div>failed to load</div>
    // if (isLoadingPipeGeo) return <div>loading...</div>
    
    if (error) return <div>failed to load</div>
    if (isLoading) return <div>loading...</div>

    return (
      <div className="flex-1 w-full flex flex-col gap-3">
        <div className="flex justify-end">
          <Button type="submit">View Component</Button>
        </div>
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
              { type === 'platform' ? <SpecHead data={data?.data} /> : <Spec1Pipeline data={data?.data} /> }
            </Suspense>
          </TabsContent>
          <TabsContent value="spec2">
            <Suspense fallback={<Loading />}>
              { type === 'platform' ? <Spec2Platform /> : <Spec2Pipeline /> }
            </Suspense>
          </TabsContent>
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