import { redirect } from "next/navigation";

export default async function DashboardPlatformIdRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/field/platform/${id}`);
}
