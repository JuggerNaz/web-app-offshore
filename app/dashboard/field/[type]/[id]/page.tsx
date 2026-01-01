"use client";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SpecHead from "@/components/forms/spec1";
import { useEffect, useState, Suspense } from "react";
import Comments from "@/components/comment/comments";
import Attachments from "@/components/attachment/attachments";
import Components from "@/components/component/components";
import StructureImage from "@/components/structure-image/structure-image";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import Spec1Pipeline from "@/components/forms/spec1-pipeline";
import Spec2Platform from "@/components/forms/spec2-platform";
import { Button } from "@/components/ui/button";
import Spec2Pipeline from "@/components/forms/spec2-pipeline";
import { getDefaultsForSchema } from "zod-defaults";
import { PipelineSchema, PlatformSchema } from "@/utils/schemas/zod";
import {
  FileText,
  Layers,
  Image as ImageIcon,
  MessageSquare,
  Paperclip,
  Boxes,
  Database,
  Activity,
  Save,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function DetailPage() {
  const { type, id } = useParams();
  const [pageId, setPageId] = useAtom(urlId);
  const [pageType, setPageType] = useAtom(urlType);
  const [activeTab, setActiveTab] = useState("spec1");

  //avoid calling api when id is new
  const { data, error, isLoading } = useSWR(id === "new" ? null : `/api/${type}/${id}`, fetcher);

  const defaults = getDefaultsForSchema(PlatformSchema);
  defaults.plat_id = 0;
  const pipelineDefaults = getDefaultsForSchema(PipelineSchema);
  pipelineDefaults.pipe_id = 0;

  useEffect(() => {
    const resolvedType = Array.isArray(type) ? type[0] : type;
    setPageId(parseInt(id as string) ?? 0);
    setPageType(resolvedType || "platform");
  }, []);

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl mb-4 text-red-500">
        <Activity className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-black tracking-tight mb-2">Failed to Load Asset</h2>
      <p className="text-slate-500 max-w-xs mx-auto mb-6">We couldn't retrieve the data for this {type}.</p>
      <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl px-8 font-bold">Retry</Button>
    </div>
  );

  if (isLoading) return (
    <div className="flex-1 flex flex-col items-center justify-center p-20 space-y-4">
      <div className="w-16 h-16 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Synchronizing Data...</p>
    </div>
  );

  const isNew = id === "new";
  const title = data?.data?.title || (isNew ? `New ${type}` : "Loading...");

  return (
    <div className="flex-1 w-full flex flex-col animate-in fade-in duration-700 h-full overflow-hidden">
      <Tabs defaultValue="spec1" onValueChange={setActiveTab} className="w-full h-full flex flex-col">
        {/* Fixed Top Header Section */}
        <div className="bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b px-8 pt-8 pb-6 shadow-sm space-y-6 shrink-0 z-20">
          <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1.5 px-0.5">
                <span className="opacity-50">Engineering</span>
                <div className="h-1 w-1 rounded-full bg-blue-500" />
                <span className="text-blue-600/80">{type} Details</span>
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase leading-none">{title}</h1>
            </div>

            {activeTab === "spec1" && (
              <Button
                form="asset-form"
                type="submit"
                className="rounded-xl h-11 px-6 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 transition-all gap-2"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            )}
          </div>

          <TabsList className="w-full max-w-7xl mx-auto flex h-14 items-center justify-start bg-slate-100/50 dark:bg-slate-900/50 p-1.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 overflow-x-auto overflow-y-hidden no-scrollbar">
            <TabTrigger value="spec1" icon={<FileText className="h-4 w-4" />} label="Basic Specs" />
            <TabTrigger value="spec2" icon={<Database className="h-4 w-4" />} label="Extended Data" disabled={isNew} />
            <TabTrigger value="structure-image" icon={<ImageIcon className="h-4 w-4" />} label="Visuals" disabled={isNew} />
            <TabTrigger value="comments" icon={<MessageSquare className="h-4 w-4" />} label="Discussions" disabled={isNew} />
            <TabTrigger value="attachments" icon={<Paperclip className="h-4 w-4" />} label="Assets" disabled={isNew} />
            <TabTrigger value="components" icon={<Boxes className="h-4 w-4" />} label="Components" disabled={isNew} />
          </TabsList>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-slate-50/30 dark:bg-transparent">
          <div className="max-w-7xl mx-auto w-full pt-2 px-8 pb-8">
            <TabsContent value="spec1" className="focus-visible:outline-none m-0">
              <Suspense fallback={<Loading />}>
                {type === "platform" ? (
                  <SpecHead data={isNew ? defaults : data?.data} />
                ) : (
                  <Spec1Pipeline data={isNew ? pipelineDefaults : data?.data} />
                )}
              </Suspense>
            </TabsContent>
            <TabsContent value="spec2" className="focus-visible:outline-none m-0">
              <Suspense fallback={<Loading />}>
                {type === "platform" ? <Spec2Platform /> : <Spec2Pipeline />}
              </Suspense>
            </TabsContent>
            <TabsContent value="structure-image" className="focus-visible:outline-none m-0">
              <Suspense fallback={<Loading />}>
                <StructureImage />
              </Suspense>
            </TabsContent>
            <TabsContent value="comments" className="focus-visible:outline-none m-0">
              <Comments />
            </TabsContent>
            <TabsContent value="attachments" className="focus-visible:outline-none m-0">
              <Attachments />
            </TabsContent>
            <TabsContent value="components" className="focus-visible:outline-none m-0">
              <Components />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

function TabTrigger({ value, icon, label, disabled }: { value: string, icon: React.ReactNode, label: string, disabled?: boolean }) {
  return (
    <TabsTrigger
      value={value}
      disabled={disabled}
      className={cn(
        "flex-1 md:flex-none flex items-center justify-center gap-2.5 px-6 h-11 rounded-[14px] text-xs font-bold uppercase tracking-wider transition-all duration-300",
        "data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-blue-600 data-[state=active]:shadow-lg active:scale-95 border border-transparent",
        "data-[state=inactive]:text-slate-500 hover:data-[state=inactive]:text-slate-900 dark:hover:data-[state=inactive]:text-white",
        disabled && "opacity-40 grayscale pointer-events-none"
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </TabsTrigger>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center p-20">
      <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}
