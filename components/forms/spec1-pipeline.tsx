"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { PipelineSchema } from "@/utils/schemas/zod";
import { RowWrap, ColWrap } from "@/components/forms/utils";
import { FormFieldWrap } from "./form-field-wrap";
import { fetcher } from "@/utils/utils";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { Separator } from "../ui/separator";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

type Props = {
  data?: any; //TODO: use real type rather than any
};

export default function Spec1Pipeline({ data }: Props) {
  const router = useRouter();

  const {
    data: libData,
    error: libError,
    isLoading: libLoading,
  } = useSWR(`/api/library/${"OILFIELD"}`, fetcher);

  const normalizeDate = (value: string | null | undefined) => {
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  };

  const initialData = data
    ? { ...data, inst_date: normalizeDate((data as any).inst_date) }
    : data;

  const form = useForm<z.infer<typeof PipelineSchema>>({
    resolver: zodResolver(PipelineSchema),
    defaultValues: initialData,
  });

  const onSubmit = async (values: z.infer<typeof PipelineSchema>) => {
    if (values.pipe_id === 0) {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        body: JSON.stringify(values),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("Pipeline created");
        mutate(`/api/platform/${values.pipe_id}`);
        router.push(`/dashboard/structure/pipeline/${data.data.pipe_id}`);
      } else {
        toast.error("Failed to create pipeline");
      }
    } else {
      const res = await fetch(`/api/pipeline/${values.pipe_id}`, {
        method: "PUT",
        body: JSON.stringify(values),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("Pipeline updated");
        mutate(`/api/pipeline/${values.pipe_id}`);
      } else {
        toast.error("Failed to update pipeline");
      }
    }
  };

  if (libError) return <div>failed to load</div>;
  if (libLoading) return <div>loading...</div>;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <RowWrap>
          <ColWrap>
            <FormFieldWrap label="Title" name="title" form={form} placeholder="title" />
            <FormFieldWrap
              label="Oil Field"
              name="pfield"
              options={libData.data
                .filter((x: any) => x.lib_code == "OILFIELD")
                .map((x: any) => {
                  return { label: x.lib_desc, value: x.lib_id };
                })}
              form={form}
              ftype="select"
            />
            <FormFieldWrap
              label="Inst. Date"
              name="inst_date"
              form={form}
              placeholder="instantiate date"
              type="date"
            />
          </ColWrap>
          <ColWrap>
            <FormFieldWrap label="Description" name="pdesc" form={form} placeholder="description" />
            <FormFieldWrap
              label="Depth"
              name="depth"
              form={form}
              placeholder="depth"
              description="m"
            />
            <FormFieldWrap
              label="Design Life"
              name="desg_life"
              form={form}
              placeholder="design life"
              description="year"
            />
          </ColWrap>
          <ColWrap>
            <FormFieldWrap label="Medium" name="ptype" form={form} placeholder="" />
            <FormFieldWrap label="Process" name="process" form={form} placeholder="" />
          </ColWrap>
        </RowWrap>
        <Separator />
        <RowWrap>
          <ColWrap>
            <div className="font-bold text-center">Location</div>
            <FormFieldWrap label="STARTS AT" name="st_loc" form={form} placeholder="" />
            <FormFieldWrap label="ENDS AT" name="end_loc" form={form} placeholder="" />
          </ColWrap>
          <ColWrap>
            <div className="font-bold text-center">KP</div>
            <FormFieldWrap label="" name="st_fp" form={form} placeholder="" description="m" />
            <FormFieldWrap label="" name="end_fp" form={form} placeholder="" description="m" />
          </ColWrap>
          <ColWrap>
            <div className="font-bold text-center">Easting</div>
            <FormFieldWrap label="" name="st_x" form={form} placeholder="" description="m" />
            <FormFieldWrap label="" name="end_x" form={form} placeholder="" description="m" />
          </ColWrap>
          <ColWrap>
            <div className="font-bold text-center">Northing</div>
            <FormFieldWrap label="" name="st_y" form={form} placeholder="" description="m" />
            <FormFieldWrap label="" name="end_y" form={form} placeholder="" description="m" />
          </ColWrap>
        </RowWrap>
        <Separator />
        <RowWrap>
          <div className="flex-col w-4/5 space-y-5">
            <div className="     "></div>
            <RowWrap>
              <ColWrap>
                <FormFieldWrap
                  label="Length"
                  name="plength"
                  form={form}
                  placeholder=""
                  ftype="vertical"
                  description="km"
                />
              </ColWrap>
              <ColWrap>
                <FormFieldWrap
                  label="Diameter"
                  name="line_diam"
                  form={form}
                  placeholder=""
                  ftype="vertical"
                  description="mm"
                />
              </ColWrap>
              <ColWrap>
                <FormFieldWrap
                  label="Wall Thicknees"
                  name="wall_thk"
                  form={form}
                  placeholder=""
                  ftype="vertical"
                  description="mm"
                />
              </ColWrap>
              <ColWrap>
                <FormFieldWrap
                  label="Material"
                  name="material"
                  form={form}
                  placeholder=""
                  ftype="vertical"
                />
              </ColWrap>
            </RowWrap>
            <RowWrap>
              <ColWrap>
                <FormFieldWrap
                  label="CP System"
                  name="cp_system"
                  form={form}
                  placeholder=""
                  ftype="vertical"
                />
                <FormFieldWrap
                  label="Design Pressure"
                  name="desg_press"
                  form={form}
                  placeholder=""
                  ftype="vertical"
                  description="bars"
                />
                <FormFieldWrap
                  label="Constructional Span"
                  name="span_cons"
                  form={form}
                  placeholder=""
                  ftype="vertical"
                  description="m"
                />
              </ColWrap>
              <ColWrap>
                <FormFieldWrap
                  label="Corrosion Coating"
                  name="corr_ctg"
                  form={form}
                  placeholder=""
                  ftype="vertical"
                />
                <FormFieldWrap
                  label="Operating Pressure"
                  name="oper_press"
                  form={form}
                  placeholder=""
                  ftype="vertical"
                  description="bars"
                />
                <FormFieldWrap
                  label="Operational Span"
                  name="span_oper"
                  form={form}
                  placeholder=""
                  ftype="vertical"
                  description="m"
                />
              </ColWrap>
              <ColWrap>
                <div className="flex gap-2">
                  <FormFieldWrap
                    label="Concrete Coating"
                    name="conc_ctg"
                    form={form}
                    placeholder=""
                    ftype="vertical"
                    formControlClass="grow"
                  />
                  <FormFieldWrap
                    label="&nbsp;"
                    name="conc_ctg_per"
                    form={form}
                    placeholder=""
                    ftype="vertical"
                    description="%"
                    formControlClass="w-[50px] text-center"
                  />
                </div>
                <FormFieldWrap
                  label="Line Burried"
                  name="burial"
                  form={form}
                  placeholder=""
                  ftype="vertical"
                  description="%"
                />
                <FormFieldWrap
                  label="Installation Contractor"
                  name="inst_ctr"
                  form={form}
                  placeholder=""
                  ftype="vertical"
                />
              </ColWrap>
            </RowWrap>
          </div>
          <div className="flex flex-col border rounded w-1/5 p-5 justify-between">
            <div>
              The default unit that to be applied for this platform, its components and inspections.
            </div>
            <FormFieldWrap
              label=""
              name="def_unit"
              form={form}
              placeholder="default unit"
              ftype="vertical"
            />
          </div>
        </RowWrap>
        <div className="flex justify-end">
          <Button type="submit">
            <Save className="" size={16} />
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
}
