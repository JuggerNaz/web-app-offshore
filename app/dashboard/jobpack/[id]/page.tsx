"use client";

import { use } from "react";
import JobpackForm from "./jobpack-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function JobpackFormPage({ params }: PageProps) {
  const { id } = use(params);
  return <JobpackForm id={id} />;
}
