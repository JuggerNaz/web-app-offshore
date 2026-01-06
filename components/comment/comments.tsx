import { TabsContent } from "@/components/ui/tabs";

import { urlId, urlType } from "@/utils/client-state";
import { useAtom } from "jotai";
import useSWR from "swr";
import { CommentDialog } from "../dialogs/comment-dialog";
import { comments } from "@/components/data-table/columns";
import { DataTable } from "@/components/data-table/data-table";
import { fetcher } from "@/utils/utils";

export default function Comments() {
  const [pageId, setPageId] = useAtom(urlId);
  const [pageType, setPageType] = useAtom(urlType);

  const { data, error, isLoading } = useSWR(`/api/comment/${pageType}/${pageId}`, fetcher);

  if (error) return (
    <div className="flex flex-col items-center justify-center p-20 text-slate-400">
      <p className="font-bold text-xs uppercase tracking-widest">Connection Error</p>
    </div>
  );

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <div className="w-8 h-8 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Fetching Discussions...</p>
    </div>
  );

  return (
    <div className="p-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <DataTable
        columns={comments}
        data={data?.data}
        disableRowClick={true}
        toolbarActions={<CommentDialog />}
      />
    </div>
  );
}
