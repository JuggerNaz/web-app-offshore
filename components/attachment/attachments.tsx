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

  if (error) return <div>failed to load</div>;
  if (isLoading) return <div>loading...</div>;

  return (
    <TabsContent value="attachments" className="p-4">
      <DataTable
        columns={attachments}
        data={data?.data}
        disableRowClick={true}
        toolbarActions={<AttachmentDialog />}
      />
    </TabsContent>
  );
}
