"use client"
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import SpecHead from "@/components/forms/spec1";
import { useEffect, useState, Suspense } from "react";
import Comments from "@/components/comment/comments";
import Attachments from "@/components/attachment/attachments";
import Components from "@/components/component/components";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import Spec1Pipeline from "@/components/forms/spec1-pipeline";
import Spec2Platform from "@/components/forms/spec2-platform";
import { Button } from "@/components/ui/button";
import Spec2Pipeline from "@/components/forms/spec2-pipeline";
import {getDefaultsForSchema} from 'zod-defaults'
import { PipelineSchema, PlatformSchema } from "@/utils/schemas/zod"

export default function DetailPage() {
    const { type, id } = useParams();
    const [pageId, setPageId] = useAtom(urlId)
    const [pageType, setPageType] = useAtom(urlType)

    //avoid calling api when id is new
    const { data, error, isLoading } = useSWR(id === 'new' ? null : `/api/${type}/${id}`, fetcher)
    // const { data, error, isLoading } = useSWR(`/api/${type}/${id}`, fetcher)

    const defaults = getDefaultsForSchema(PlatformSchema)
    defaults.plat_id = 0
    const pipelineDefaults = getDefaultsForSchema(PipelineSchema)
    pipelineDefaults.pipe_id = 0

    useEffect(() => {
      const resolvedType = Array.isArray(type) ? type[0] : type;
      setPageId(parseInt(id as string) ?? 0);
      setPageType(resolvedType || "platform"); // Provide a fallback for `type` if needed
    }, []);
    
    if (error) return <div>failed to load</div>
    if (isLoading) return <div>loading...</div>

    return (
      <div className="flex-1 w-full flex flex-col gap-3">
        <Tabs defaultValue="spec1">
          <TabsList className="w-full">
            <TabsTrigger className="grow" value="spec1">Specification</TabsTrigger>
            <TabsTrigger className="grow" value="spec2" disabled={id === 'new' ? true : false}>Specification 2</TabsTrigger>
            <TabsTrigger className="grow" value="structure-image" disabled={id === 'new' ? true : false}>Structure Image</TabsTrigger>
            <TabsTrigger className="grow" value="comments" disabled={id === 'new' ? true : false}>Comments</TabsTrigger>
            <TabsTrigger className="grow" value="attachments" disabled={id === 'new' ? true : false}>Attachment</TabsTrigger>
            <TabsTrigger className="grow" value="components" disabled={id === 'new' ? true : false}>Components</TabsTrigger>
          </TabsList>
          <TabsContent value="spec1" className="py-2 px-1">
            <Suspense fallback={<Loading />}>
              { type === 'platform' ? <SpecHead data={id === 'new' ? defaults : data?.data } /> : <Spec1Pipeline data={id === 'new' ? pipelineDefaults : data?.data} /> }
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
          <TabsContent value="components"><Components /></TabsContent>
        </Tabs>
      </div>
    );
}

function Loading() {
  return <h2>🌀 Loading...</h2>;
}