import { redirect } from "next/navigation";

export default async function PipelineIdRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/field/pipeline/${id}`);
}
