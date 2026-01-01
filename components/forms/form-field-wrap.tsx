import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FormFieldWrap({
  label,
  name,
  form,
  description,
  placeholder,
  ftype = "normal",
  formControlClass = "",
  formLabelClass = "",
  type = "text",
  options,
  maxLength,
  disabled,
  min,
  max,
  step,
}: {

  label: string;
  name: string;
  form: any;
  description?: string;
  placeholder?: string;
  ftype?: "normal" | "small" | "vertical" | "checkbox" | "select" | "vselect" | "slider";
  formControlClass?: string;
  formLabelClass?: string;
  type?: "text" | "number" | "email" | "password" | "date" | "datetime-local";
  options?: { label: string; value: string }[];
  maxLength?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) =>
        ftype === "normal" ? (
          <FormItemNormal
            label={label}
            description={description}
            placeholder={placeholder}
            field={field}
            type={type}
            maxLength={maxLength}
            disabled={disabled}
          />
        ) : ftype === "small" ? (
          <FormItemSmall
            label={label}
            description={description}
            placeholder={placeholder}
            field={field}
            type={type}
            maxLength={maxLength}
            disabled={disabled}
          />
        ) : ftype === "checkbox" ? (
          <FormCheckbox label={label} field={field} />
        ) : ftype === "select" ? (
          <FormSelect label={label} options={options} field={field} />
        ) : ftype === "vselect" ? (
          <FormSelectVertical label={label} options={options} field={field} />
        ) : ftype === "slider" ? (
          <FormItemSlider
            label={label}
            field={field}
            min={min}
            max={max}
            step={step}
            description={description}
          />
        ) : (
          <FormItemVertical
            label={label}
            description={description}
            placeholder={placeholder}
            field={field}
            formControlClass={formControlClass}
            formLabelClass={formLabelClass}
            type={type}
            maxLength={maxLength}
            disabled={disabled}
          />
        )
      }
    />
  );
}

export function FormItemNormal({
  label,
  description,
  placeholder,
  field,
  type,
  maxLength,
  disabled,
}: {
  label: string;
  description?: string;
  placeholder?: string;
  field: any;
  type: "text" | "number" | "email" | "password" | "date" | "datetime-local";
  maxLength?: string;
  disabled?: boolean;
}) {
  return (
    <FormItem>
      {label && <FormLabel>{label}</FormLabel>}
      <FormControl>
        <Input
          placeholder={placeholder ?? "N/A"}
          {...field}
          type={type}
          maxLength={maxLength}
          disabled={disabled}
        />
      </FormControl>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormItem>
  );
}

export function FormItemVertical({
  label,
  description,
  placeholder,
  field,
  formControlClass,
  formLabelClass,
  type,
  maxLength,
  disabled,
}: {
  label: string;
  description?: string;
  placeholder?: string;
  field: any;
  formControlClass?: string;
  formLabelClass?: string;
  type?: "text" | "number" | "email" | "password" | "date" | "datetime-local";
  maxLength?: string;
  disabled?: boolean;
}) {
  return (
    <FormItem className="flex flex-col gap-2">
      <div className={`w-full text-sm font-medium ${formLabelClass}`}>{label}</div>
      <div className="flex items-center justify-center gap-3 w-full">
        <FormControl className={formControlClass}>
          <Input
            placeholder={placeholder ?? "N/A"}
            {...field}
            type={type}
            maxLength={maxLength}
            disabled={disabled}
          />
        </FormControl>
        {description && <FormDescription>{description}</FormDescription>}
      </div>
      <FormMessage />
    </FormItem>
  );
}

export function FormItemSmall({
  label,
  description,
  placeholder,
  field,
  type,
  maxLength,
  disabled,
}: {
  label: string;
  description?: string;
  placeholder?: string;
  field: any;
  type?: "text" | "number" | "email" | "password" | "date" | "datetime-local";
  maxLength?: string;
  disabled?: boolean;
}) {
  return (
    <FormItem className="flex flex-col w-11 gap-2">
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <Input
          placeholder={placeholder ?? "N/A"}
          {...field}
          type={type}
          maxLength={maxLength}
          disabled={disabled}
        />
      </FormControl>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormItem>
  );
}

export function FormCheckbox({ label, field }: { label: string; field: any }) {
  return (
    <FormItem
      //key={item.id}
      className="flex flex-row items-start space-x-0 space-y-0 my-4"
    >
      <FormControl>
        {typeof field.value === "string" && field.value === "YES" ? (
          <Checkbox
            checked={field.value === "NO" ? false : true}
            onCheckedChange={(checked) => {
              return field.onChange(checked ? "YES" : "NO");
            }}
          />
        ) : (
          <Checkbox
            checked={field.value === 0 ? false : true}
            onCheckedChange={(checked) => {
              return field.onChange(checked ? 1 : 0);
            }}
          />
        )}
      </FormControl>
      <FormLabel className="text-sm font-normal">{label}</FormLabel>
    </FormItem>
  );
}

export function FormSelect({
  label,
  options,
  field,
}: {
  label: string;
  options?: { label: string; value: string }[];
  field: any;
}) {
  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <SelectTrigger className="">
          <SelectValue placeholder={`Select ${label}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{label}</SelectLabel>
            {options!.map((item, index) => (
              <SelectItem key={index} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FormItem>
  );
}

export function FormSelectVertical({
  label,
  options,
  field,
}: {
  label: string;
  options?: { label: string; value: string }[];
  field: any;
}) {
  return (
    <FormItem className="flex flex-col gap-2">
      <div className={`w-full text-sm font-medium`}>{label}</div>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <SelectTrigger className="">
          <SelectValue placeholder={`Select ${label}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{label}</SelectLabel>
            {options!.map((item, index) => (
              <SelectItem key={index} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FormItem>
  );
}

export function FormItemSlider({
  label,
  field,
  min = 0,
  max = 100,
  step = 1,
  description,
}: {
  label: string;
  field: any;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}) {
  return (
    <FormItem className="space-y-4">
      <div className="flex justify-between items-center">
        <FormLabel>{label}</FormLabel>
        <span className="text-sm text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
          {field.value}
        </span>
      </div>
      <FormControl>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground w-8 text-right">{min}</span>
          <Input
            type="range"
            min={min}
            max={max}
            step={step}
            value={field.value || 0}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              field.onChange(isNaN(val) ? 0 : val);
            }}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-8">{max}</span>
        </div>
      </FormControl>
      {description && <FormDescription>{description}</FormDescription>}
      <FormMessage />
    </FormItem>
  );
}
