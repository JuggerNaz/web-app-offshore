"use client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAtom } from "jotai";
import { urlId, urlType } from "@/utils/client-state";
import useSWR from "swr";
import { fetcher } from "@/utils/utils";
import { mutate } from "swr";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PipeGeoSchema } from "@/utils/schemas/zod";
import { ColWrap, RowWrap } from "./utils";
import { FormFieldWrap } from "./form-field-wrap";
import { Button } from "../ui/button";
import { Form } from "@/components/ui/form";
import { useEffect } from "react";
import { Save } from "lucide-react";

export default function Spec2Pipeline() {
  const [pageId, setPageId] = useAtom(urlId);
  const { data, error, isLoading } = useSWR(`/api/pipeline/pipegeo/${pageId}`, fetcher);

  useEffect(() => {
    if (data) form.reset(data?.data);
  }, [data]);

  const form = useForm<z.infer<typeof PipeGeoSchema>>({
    resolver: zodResolver(PipeGeoSchema),
  });

  const onSubmit = async (values: z.infer<typeof PipeGeoSchema>) => {
    if (!data.error && data.data) {
      await fetcher(`/api/pipeline/pipegeo/${values.str_id}`, {
        method: "PUT",
        body: JSON.stringify(values),
      }).then((res) => {
        mutate(`/api/pipeline/pipegeo/${values.str_id}`);
        toast("Pipeline Geodetic Parameter updated successfully");
      });
    } else {
      values.str_id = pageId;
      await fetcher(`/api/pipeline/pipegeo`, {
        method: "POST",
        body: JSON.stringify(values),
      }).then((res) => {
        mutate(`/api/pipeline/pipegeo/${values.str_id}`);
        toast("Pipeline Geodetic Parameter created successfully");
      });
    }
  };

  if (error) return <div>failed to load</div>;
  if (isLoading) return <div>loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Geodetic Parameters</CardTitle>
        {/* <CardDescription>Card Description</CardDescription> */}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            <RowWrap>
              <ColWrap>
                <FormFieldWrap
                  label="Project Name"
                  name="geo_proj_nam"
                  form={form}
                  placeholder=""
                />
                <FormFieldWrap label="Unit" name="geo_units" form={form} placeholder="" />
                <FormFieldWrap label="Datum" name="geo_datum" form={form} placeholder="" />
                <FormFieldWrap
                  label="Ellipsoid / Spheroid"
                  name="geo_elli_sph"
                  form={form}
                  placeholder=""
                />
                <FormFieldWrap label="Datum Shift" name="geo_dir" form={form} placeholder="" />
                <FormFieldWrap
                  label="Dx"
                  name="geo_dx"
                  form={form}
                  placeholder=""
                  description="m"
                />
                <FormFieldWrap
                  label="Dy"
                  name="geo_dy"
                  form={form}
                  placeholder=""
                  description="m"
                />
                <FormFieldWrap
                  label="Dz"
                  name="geo_dz"
                  form={form}
                  placeholder=""
                  description="m"
                />
              </ColWrap>
            </RowWrap>
            <div className="flex justify-end">
              <Button type="submit">
                <Save />
                Save
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
      {/* <CardFooter>
      <p>Card Footer</p>
    </CardFooter> */}
    </Card>
  );
}
