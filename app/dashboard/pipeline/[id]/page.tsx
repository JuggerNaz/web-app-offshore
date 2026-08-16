import { redirect } from "next/navigation";

export default async function DashboardPipelineIdRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/field/pipeline/${id}`);
}
