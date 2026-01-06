import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import FileUpload from "@/components/forms/FileUpload";
import { AttachmentDialog } from "../dialogs/attachment-dialog";
import { DataTable } from "../data-table/data-table";
import useSWR from "swr";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import { fetcher } from "@/utils/utils";
import { attachments } from "../data-table/columns";

export default function Attachments() {
  const [pageId, setPageId] = useAtom(urlId);
  const [pageType, setPageType] = useAtom(urlType);

  const { data, error, isLoading } = useSWR(`/api/attachment/${pageType}/${pageId}`, fetcher);

  if (error) return (
    <div className="flex flex-col items-center justify-center p-20 text-slate-400">
      <p className="font-bold text-xs uppercase tracking-widest">Connection Error</p>
    </div>
  );

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-20 gap-4">
      <div className="w-8 h-8 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Fetching Files...</p>
    </div>
  );

  return (
    <div className="p-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <DataTable
        columns={attachments}
        data={data?.data}
        disableRowClick={true}
        toolbarActions={<AttachmentDialog />}
      />
    </div>
  );
}
