
import { TabsContent } from "@/components/ui/tabs"

import { urlId, urlType } from "@/utils/client-state"
import { useAtom } from "jotai"
import useSWR from "swr"
import { CommentDialog } from "../dialogs/comment-dialog"
import { comments } from "@/components/data-table/columns"
import { DataTable } from "@/components/data-table/data-table"
import { fetcher } from "@/utils/utils";

export default function Comments() {

    const [pageId, setPageId] = useAtom(urlId)
    const [pageType, setPageType] = useAtom(urlType)

    const { data, error, isLoading } = useSWR(`/api/comment/${pageType}/${pageId}`, fetcher)

    if (error) return <div>failed to load</div>
    if (isLoading) return <div>loading...</div>

    return <TabsContent value="comments" className=" p-4 mt-4">
        <DataTable 
            columns={comments} 
            data={data?.data} 
            disableRowClick={true} 
            toolbarActions={<CommentDialog />}
        />
    </TabsContent>
}