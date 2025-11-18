"use client";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import { Input } from "../ui/input";
import { Trash2 } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { ElevationDialog } from "../dialogs/elevation-dialog";
import { mutate } from "swr";
import { toast } from "sonner";
import { DataTable } from "../data-table/data-table";
import { levels, faces } from "../data-table/columns";
import { LevelDialog } from "../dialogs/level-dialog";
import { FacesDialog } from "../dialogs/faces-dialog";

export default function Spec2Platform() {
  const [pageId, setPageId] = useAtom(urlId);

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

  if (error) return <div>failed to load</div>;
  if (isLoading) return <div>loading...</div>;
  if (levelError) return <div>failed to level</div>;
  if (levelIsLoading) return <div>loading levels...</div>;
  if (facesError) return <div>failed to faces</div>;
  if (facesIsLoading) return <div>loading faces...</div>;

  const handleDelete = async (elev: any) => {
    await fetcher(`/api/platform/elevation`, {
      method: "DELETE",
      body: JSON.stringify(elev),
    }).then((res) => {
      mutate(`/api/platform/elevation/${pageId}`);
      toast("Elevation deleted successfully");
    });
  };

  return (
    <div className="flex gap-2">
      <div className="flex flex-col gap-2 border rounded p-3 w-2/5">
        Platform Elevations (m)
        <div className="flex gap-2 grow">
          <div className="w-1/2 rounded bg-muted p-2">
            <div className="font-bold text-center my-3">Above Splash Level</div>
            {data
              ? data.data
                  .filter((x: { orient: string }) => x.orient === "ABOVE")
                  .map((item: any, index: number) => (
                    <div className="flex relative mb-1" key={index}>
                      <Input type="text" value={item.elv} />
                      <div className="absolute inset-y-0 end-0 flex items-center cursor-pointer z-20 pe-3">
                        <Trash2 size={16} onClick={() => handleDelete(item)} />
                      </div>
                    </div>
                  ))
              : null}
          </div>
          <div className="w-1/2 rounded bg-muted p-2">
            <div className="font-bold text-center my-3">Below Splash Level</div>
            {data
              ? data.data
                  .filter((x: { orient: string }) => x.orient === "BELOW")
                  .map((item: any, index: number) => (
                    <div className="flex relative mb-1" key={index}>
                      <Input type="text" value={item.elv} />
                      <div className="absolute inset-y-0 end-0 flex items-center cursor-pointer z-20 pe-3">
                        <Trash2 size={16} onClick={() => handleDelete(item)} />
                      </div>
                    </div>
                  ))
              : null}
          </div>
        </div>
        <div className="flex justify-end">
          <ElevationDialog />
        </div>
      </div>
      <div className="flex flex-col gap-2 p-3 w-3/5 border rounded">
        <div className="flex flex-col gap-2">
          Levels
          <DataTable columns={levels} data={levelData.data} />
          <div className="flex justify-end">
            <LevelDialog />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          Faces
          <DataTable columns={faces} data={facesData.data} />
          <div className="flex justify-end">
            <FacesDialog />
          </div>
        </div>
      </div>
    </div>
  );
}
