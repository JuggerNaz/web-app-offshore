import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { X, Trash2 } from "lucide-react";
import useSWR from "swr"
import { fetcher } from "@/utils/utils";
import { ElevationDialog } from "../dialogs/elevation-dialog";

export default function Spec2Platform () {

    const [pageId, setPageId] = useAtom(urlId)
    const [pageType, setPageType] = useAtom(urlType)

    const { data, error, isLoading } = useSWR(`/api/platform/elevation/${pageId}`, fetcher)

    if (error) return <div>failed to load</div>
    if (isLoading) return <div>loading...</div>

    return (
        <div className="flex gap-2">
            <div className="flex flex-col gap-2 border rounded p-3 w-2/5">
                Platform Elevations (m)
                <div className="flex gap-2">
                    <div className="w-1/2 rounded bg-muted p-2">
                        <div className="font-bold text-center my-3">Above Splash Level</div>
                        {
                            data ? data.data.filter((x: { orient: string; }) => x.orient === 'ABOVE').map((item, index) => (
                                <div className="flex relative mb-1" key={index}>
                                    <Input type="text" value={item.elv} />
                                    <div className="absolute inset-y-0 end-0 flex items-center cursor-pointer z-20 pe-3">
                                        <Trash2 size={16} />
                                    </div>
                                </div>
                            )) : null
                        }
                    </div>
                    <div className="w-1/2 rounded bg-muted p-2">
                        <div className="font-bold text-center my-3">Below Splash Level</div>
                        {
                            data ? data.data.filter((x: { orient: string; }) => x.orient === 'BELOW').map((item, index) => (
                                <div className="flex relative mb-1" key={index}>
                                    <Input type="text" value={item.elv} />
                                    <div className="absolute inset-y-0 end-0 flex items-center cursor-pointer z-20 pe-3">
                                        <Trash2 size={16} />
                                    </div>
                                </div>
                            )) : null
                        }
                    </div>
                </div>
                <div className="flex">
                        <ElevationDialog />
                </div>
            </div>
            <div className="flex flex-col gap-2 p-3 w-3/5 border rounded">
                platform
            </div>
        </div>
    )
}