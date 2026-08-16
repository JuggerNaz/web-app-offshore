import { redirect } from "next/navigation";

export default async function PlatformIdRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/field/platform/${id}`);
}
