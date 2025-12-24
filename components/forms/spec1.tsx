"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { PlatformSchema } from "@/utils/schemas/zod";
import { RowWrap, ColWrap } from "@/components/forms/utils";
import { CollapsibleField } from "@/components/forms/utils";
import { FormFieldWrap } from "./form-field-wrap";
import { fetcher } from "@/utils/utils";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

type Props = {
  data?: any; //TODO: use real type rather than any
};

export default function Spec1({ data }: Props) {
  const router = useRouter();

  const normalizeDate = (value: string | null | undefined) => {
    if (!value) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  };

  const initialData = data
    ? { ...data, inst_date: normalizeDate((data as any).inst_date) }
    : data;

  const {
    data: libData,
    error,
    isLoading,
  } = useSWR(`/api/library/${"PLAT_TYP,PLAT_FUNCT,PLAT_MAT,PLAT_CP,CORR_CTG,PLAT_CONT,OILFIELD"}`, fetcher);

  const form = useForm<z.infer<typeof PlatformSchema>>({
    resolver: zodResolver(PlatformSchema),
    defaultValues: initialData,
  });

  const legsCountRaw = form.watch("plegs");
  const legsCount = Number(legsCountRaw) || 0;
  const isLegDisabled = (legNumber: number) => legNumber > legsCount;

  const onSubmit = async (values: z.infer<typeof PlatformSchema>) => {
    if (values.plat_id == 0) {
      const res = await fetch(`/api/platform`, {
        method: "POST",
        body: JSON.stringify(values),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("Platform created");
        mutate(`/api/platform/${values.plat_id}`);
        router.push(`/dashboard/field/platform/${data.data.plat_id}`);
      } else {
        toast.error("Failed to create platform");
      }
    } else {
      const res = await fetch(`/api/platform/${values.plat_id}`, {
        method: "PUT",
        body: JSON.stringify(values),
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (res.ok) {
        const data = await res.json();
        toast.success("Platform updated");
        mutate(`/api/platform/${values.plat_id}`);
      } else {
        toast.error("Failed to update platform");
      }
    }
  };

  if (error) return <div>failed to load</div>;
  if (isLoading) return <div>loading...</div>;

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
            <FormFieldWrap label="Depth (m)" name="depth" form={form} placeholder="depth" />
            <FormFieldWrap
              label="Design Life"
              name="desg_life"
              form={form}
              placeholder="design life"
              ftype="normal"
              description="year"
            />
          </ColWrap>
          <ColWrap>
            {/* <FormFieldWrap label="Type" name="ptype" form={form} placeholder="type" /> */}
            <FormFieldWrap
              label="Type"
              name="ptype"
              options={libData.data
                .filter((x: any) => x.lib_code == "PLAT_TYP")
                .map((x: any) => {
                  return { label: x.lib_desc, value: x.lib_id };
                })}
              form={form}
              ftype="select"
            />
            {/* <FormFieldWrap label="Function" name="ptype" form={form} placeholder="function" /> */}
            <FormFieldWrap
              label="Function"
              name="process"
              options={libData.data
                .filter((x: any) => x.lib_code == "PLAT_FUNCT")
                .map((x: any) => {
                  return { label: x.lib_desc, value: x.lib_id };
                })}
              form={form}
              ftype="select"
            />
          </ColWrap>
        </RowWrap>
        <RowWrap>
          <div className="w-1/5 space-y-2">
            <FormFieldWrap
              label="Norting"
              name="st_north"
              form={form}
              placeholder="northing"
              ftype="vertical"
              description="m"
            />
            <FormFieldWrap
              label="Easting"
              name="st_east"
              form={form}
              placeholder="easting"
              ftype="vertical"
              description="m"
            />
          </div>
          <div className="">
            <div className="flex gap-3">
              <div className="flex flex-col justify-center gap-2">
                <FormFieldWrap
                  label="No. of Legs"
                  name="plegs"
                  form={form}
                  placeholder=""
                  ftype="vertical"
                  formControlClass="w-1/2 text-center"
                  formLabelClass="text-center"
                />
              </div>
              <div className="flex flex-col gap-2">
                {/* Top row: legs 1-10 */}
                <div className="flex gap-2">
                  <FormFieldWrap label="1:" name="leg_t1" form={form} placeholder="" ftype="small" disabled={isLegDisabled(1)} />
                  <FormFieldWrap label="2:" name="leg_t2" form={form} placeholder="" ftype="small" disabled={isLegDisabled(2)} />
                  <FormFieldWrap label="3:" name="leg_t3" form={form} placeholder="" ftype="small" disabled={isLegDisabled(3)} />
                  <FormFieldWrap label="4:" name="leg_t4" form={form} placeholder="" ftype="small" disabled={isLegDisabled(4)} />
                  <FormFieldWrap label="5:" name="leg_t5" form={form} placeholder="" ftype="small" disabled={isLegDisabled(5)} />
                  <FormFieldWrap label="6:" name="leg_t6" form={form} placeholder="" ftype="small" disabled={isLegDisabled(6)} />
                  <FormFieldWrap label="7:" name="leg_t7" form={form} placeholder="" ftype="small" disabled={isLegDisabled(7)} />
                  <FormFieldWrap label="8:" name="leg_t8" form={form} placeholder="" ftype="small" disabled={isLegDisabled(8)} />
                  <FormFieldWrap label="9:" name="leg_t9" form={form} placeholder="" ftype="small" disabled={isLegDisabled(9)} />
                  <FormFieldWrap label="10:" name="leg_t10" form={form} placeholder="" ftype="small" disabled={isLegDisabled(10)} />
                </div>
                {/* Bottom row: legs 11-20 */}
                <div className="flex gap-2">
                  <FormFieldWrap label="11:" name="leg_t11" form={form} placeholder="" ftype="small" disabled={isLegDisabled(11)} />
                  <FormFieldWrap label="12:" name="leg_t12" form={form} placeholder="" ftype="small" disabled={isLegDisabled(12)} />
                  <FormFieldWrap label="13:" name="leg_t13" form={form} placeholder="" ftype="small" disabled={isLegDisabled(13)} />
                  <FormFieldWrap label="14:" name="leg_t14" form={form} placeholder="" ftype="small" disabled={isLegDisabled(14)} />
                  <FormFieldWrap label="15:" name="leg_t15" form={form} placeholder="" ftype="small" disabled={isLegDisabled(15)} />
                  <FormFieldWrap label="16:" name="leg_t16" form={form} placeholder="" ftype="small" disabled={isLegDisabled(16)} />
                  <FormFieldWrap label="17:" name="leg_t17" form={form} placeholder="" ftype="small" disabled={isLegDisabled(17)} />
                  <FormFieldWrap label="18:" name="leg_t18" form={form} placeholder="" ftype="small" disabled={isLegDisabled(18)} />
                  <FormFieldWrap label="19:" name="leg_t19" form={form} placeholder="" ftype="small" disabled={isLegDisabled(19)} />
                  <FormFieldWrap label="20:" name="leg_t20" form={form} placeholder="" ftype="small" disabled={isLegDisabled(20)} />
                </div>
              </div>
            </div>
          </div>
          <div className="w-1/5 space-y-2">
            <FormFieldWrap
              label="True North"
              name="north_angle"
              form={form}
              placeholder="true north"
              ftype="vertical"
              description="Deg."
            />
            <FormFieldWrap
              label="Platform North"
              name="north_side"
              form={form}
              placeholder="north side"
              ftype="vertical"
            />
          </div>
        </RowWrap>
        <RowWrap>
          <div className="flex-col w-4/5 space-y-5">
            <RowWrap>
              <ColWrap>
                <FormFieldWrap
                  label="Max Leg Diameter"
                  name="dleg"
                  form={form}
                  placeholder="0"
                  ftype="vertical"
                  description="mm"
                />
                <FormFieldWrap
                  label="Helipad?"
                  name="helipad"
                  form={form}
                  placeholder=""
                  ftype="checkbox"
                />
              </ColWrap>
              <ColWrap>
                <FormFieldWrap
                  label="Max Wall Thickness"
                  name="wall_thk"
                  form={form}
                  placeholder="0"
                  ftype="vertical"
                  description="mm"
                />
                <FormFieldWrap
                  label="Manned?"
                  name="manned"
                  form={form}
                  placeholder=""
                  ftype="checkbox"
                />
              </ColWrap>
              <ColWrap>
                {/* <FormFieldWrap label="Material" name="material" form={form} placeholder="material" ftype="vertical" /> */}
                <FormFieldWrap
                  label="Material"
                  name="material"
                  options={libData.data
                    .filter((x: any) => x.lib_code == "PLAT_MAT")
                    .map((x: any) => {
                      return { label: x.lib_desc, value: x.lib_id };
                    })}
                  form={form}
                  ftype="vselect"
                />
                {/* <FormFieldWrap label="Corrosion Coating" name="corr_ctc" form={form} placeholder="corrosion coating" ftype="vertical" /> */}
                <FormFieldWrap
                  label="Corrosion Coating"
                  name="corr_ctg"
                  options={libData.data
                    .filter((x: any) => x.lib_code == "CORR_CTG")
                    .map((x: any) => {
                      return { label: x.lib_desc, value: x.lib_id };
                    })}
                  form={form}
                  ftype="vselect"
                />
              </ColWrap>
              <ColWrap>
                {/* <FormFieldWrap label="CP System" name="cp_system" form={form} placeholder="cp system" ftype="vertical" /> */}
                <FormFieldWrap
                  label="CP System"
                  name="cp_system"
                  options={libData.data
                    .filter((x: any) => x.lib_code == "PLAT_CP")
                    .map((x: any) => {
                      return { label: x.lib_desc, value: x.lib_id };
                    })}
                  form={form}
                  ftype="vselect"
                />
                {/* <FormFieldWrap label="Installation Contractor" name="inst_ctr" form={form} placeholder="installation contractor" ftype="vertical" /> */}
                <FormFieldWrap
                  label="Installation Contractor"
                  name="inst_ctr"
                  options={libData.data
                    .filter((x: any) => x.lib_code == "PLAT_CONT")
                    .map((x: any) => {
                      return { label: x.lib_desc, value: x.lib_id };
                    })}
                  form={form}
                  ftype="vselect"
                />
              </ColWrap>
            </RowWrap>
            <Card>
              <CardHeader>
                <CardTitle>Number of</CardTitle>
              </CardHeader>
              <CardContent>
                <RowWrap className="">
                  <ColWrap>
                    <FormFieldWrap
                      label="Conductors"
                      name="conduct"
                      form={form}
                      placeholder="0"
                      ftype="vertical"
                      type="number"
                    />
                    <FormFieldWrap
                      label="Internal Piles"
                      name="pileint"
                      form={form}
                      placeholder="0"
                      ftype="vertical"
                    />
                  </ColWrap>
                  <ColWrap>
                    <FormFieldWrap
                      label="Slots"
                      name="cslota"
                      form={form}
                      placeholder="0"
                      ftype="vertical"
                    />
                    <FormFieldWrap
                      label="Fenders"
                      name="fender"
                      form={form}
                      placeholder="0"
                      ftype="vertical"
                    />
                  </ColWrap>
                  <ColWrap>
                    <FormFieldWrap
                      label="Risers"
                      name="riser"
                      form={form}
                      placeholder="0"
                      ftype="vertical"
                    />
                    <FormFieldWrap
                      label="Sumps"
                      name="sump"
                      form={form}
                      placeholder="0"
                      ftype="vertical"
                    />
                  </ColWrap>
                  <ColWrap>
                    <FormFieldWrap
                      label="Skirt Piles"
                      name="pileskt"
                      form={form}
                      placeholder="0"
                      ftype="vertical"
                    />
                    <FormFieldWrap
                      label="Caissons"
                      name="caisson"
                      form={form}
                      placeholder="0"
                      ftype="vertical"
                    />
                  </ColWrap>
                  <ColWrap>
                    <FormFieldWrap
                      label="Anode"
                      name="an_qty"
                      form={form}
                      placeholder="0"
                      ftype="vertical"
                    />
                    <FormFieldWrap
                      label="Crane"
                      name="crane"
                      form={form}
                      placeholder="0"
                      ftype="vertical"
                    />
                  </ColWrap>
                </RowWrap>
              </CardContent>
            </Card>
          </div>
          <Card className="w-1/5 flex flex-col">
            <CardHeader>
              <CardTitle>Default Unit</CardTitle>
            </CardHeader>
            <CardContent className="grow">
              <div>
                The default unit that to be applied for this platform, its components and
                inspections.
              </div>
            </CardContent>
            <CardFooter>
              <FormFieldWrap
                label=""
                name="def_unit"
                form={form}
                placeholder="default unit"
                ftype="vertical"
              />
            </CardFooter>
          </Card>
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
