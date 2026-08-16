import { redirect } from "next/navigation";

export default function DashboardPipelineRedirectPage() {
  redirect("/dashboard/field/pipeline");
}
