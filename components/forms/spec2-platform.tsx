"use client";
import { useAtom } from "jotai";
import { urlId } from "@/utils/client-state";
import { Ruler, Trash2, Activity, Layers2, Plus } from "lucide-react";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/utils/utils";
import { toast } from "sonner";
import { DataTable } from "../data-table/data-table";
import { levels, faces } from "../data-table/columns";
import { ElevationDialog } from "../dialogs/elevation-dialog";
import { LevelDialog } from "../dialogs/level-dialog";
import { FacesDialog } from "../dialogs/faces-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export default function Spec2Platform() {
  const [pageId] = useAtom(urlId);

  const { data, error, isLoading } = useSWR(`/api/platform/elevation/${pageId}`, fetcher);
  const {
    data: levelData,
    error: levelError,
    isLoading: levelIsLoading,
  } = useSWR(`/api/platform/level/${pageId}`, fetcher);
  const {
    data: facesData,
    error: facesError,
    isLoading: facesIsLoading,
  } = useSWR(`/api/platform/faces/${pageId}`, fetcher);

  const handleDelete = async (elev: any) => {
    try {
      await fetcher(`/api/platform/elevation`, {
        method: "DELETE",
        body: JSON.stringify(elev),
      });
      mutate(`/api/platform/elevation/${pageId}`);
      toast.success("Elevation deleted successfully");
    } catch (err) {
      toast.error("Failed to delete elevation");
    }
  };

  if (error || levelError || facesError) return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 animate-in fade-in duration-500">
      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl mb-4 text-red-500">
        <Activity className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-black tracking-tight mb-2">Sync Error</h2>
      <p className="text-slate-500 max-w-xs mx-auto mb-6">Failed to synchronize platform metadata. Please refresh the connection.</p>
      <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl px-8 font-bold">Retry Connection</Button>
    </div>
  );

  if (isLoading || levelIsLoading || facesIsLoading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4 animate-in fade-in">
      <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Extended Metadata...</p>
    </div>
  );

  const elevationsAbove = [...(data?.data?.filter((x: any) => x.orient === "ABOVE") || [])].sort((a: any, b: any) => parseFloat(a.elv || "0") - parseFloat(b.elv || "0"));
  const elevationsBelow = [...(data?.data?.filter((x: any) => x.orient === "BELOW") || [])].sort((a: any, b: any) => Math.abs(parseFloat(a.elv || "0")) - Math.abs(parseFloat(b.elv || "0")));

  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Elevations Column */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Ruler className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-black uppercase tracking-wider truncate">Elevations</CardTitle>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate">Reference (m)</p>
                  </div>
                </div>
                <ElevationDialog />
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              {/* Above Splash Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Above Splash</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {elevationsAbove.length > 0 ? (
                    elevationsAbove.map((item: any, index: number) => (
                      <ElevationItem key={index} item={item} onDelete={() => handleDelete(item)} />
                    ))
                  ) : (
                    <EmptyState text="No data above splash" />
                  )}
                </div>
              </div>

              <div className="px-2">
                <Separator className="opacity-50" />
              </div>

              {/* Below Splash Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Below Splash</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {elevationsBelow.length > 0 ? (
                    elevationsBelow.map((item: any, index: number) => (
                      <ElevationItem key={index} item={item} onDelete={() => handleDelete(item)} />
                    ))
                  ) : (
                    <EmptyState text="No data below splash" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Levels & Faces Column */}
        <div className="lg:col-span-8 space-y-8">
          {/* Levels Card */}
          <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4 px-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <Layers2 className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-black uppercase tracking-wider">Structural Levels</CardTitle>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Hierarchy Details</p>
                  </div>
                </div>
                <LevelDialog />
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <DataTable columns={levels} data={levelData?.data || []} />
            </CardContent>
          </Card>

          {/* Faces Card */}
          <Card className="rounded-[2rem] border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/40 dark:shadow-none overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4 px-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-black uppercase tracking-wider">Structural Faces</CardTitle>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Orientation Map</p>
                  </div>
                </div>
                <FacesDialog />
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <DataTable columns={faces} data={facesData?.data || []} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ElevationItem({ item, onDelete }: { item: any, onDelete: () => void }) {
  return (
    <div className="group flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 hover:border-blue-500/30 hover:shadow-md transition-all">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
          <Ruler className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-900 dark:text-white leading-none mb-1">Elevation</span>
          <span className="font-mono text-[10px] text-slate-500 font-bold tracking-tight">Value: {item.elv}m</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="h-8 w-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-8 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-2xl">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{text}</span>
    </div>
  );
}
