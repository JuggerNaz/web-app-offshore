import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";

export default function Spec2Platform () {

    const [pageId, setPageId] = useAtom(urlId)
    const [pageType, setPageType] = useAtom(urlType)

    return (
        <div className="flex gap-2">
            <div className="flex flex-col gap-2 border rounded p-3 w-1/2">
                platform
                <div className="flex gap-2">
                    <div className="w-1/2 rounded bg-muted p-2">
                        <div className="font-bold text-center mb-3">Above Splash Level</div>
                        <div className="flex gap-2">
                            <input type="text" className="w-1/2 border p-1" />
                            
                        </div>
                    </div>
                    <div className="w-1/2 rounded bg-muted p-2">
                        <div className="font-bold text-center mb-3">Below Splash Level</div>
                        <div className="flex gap-2">
                            <input type="text" className="w-1/2 border p-1 bg-mu" />
                            
                        </div>
                    </div>
                </div>
            </div>
            <div className="flex flex-col gap-2 p-3 w-1/2 border rounded">
                platform
            </div>
        </div>
    )
}