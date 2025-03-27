import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
  } from "@/components/ui/select"

export function FormFieldWrap ({
    label, name, form, description, 
    placeholder, ftype = 'normal', formControlClass = '', formLabelClass = '',
    type = 'text', options, maxLength
}
:
{
    label:string, 
    name:string, 
    form:any, 
    description?:string, 
    placeholder?:string, 
    ftype?: 'normal' | 'small' | 'vertical' | 'checkbox' | 'select' | 'vselect',
    formControlClass?: string,
    formLabelClass?: string,
    type?: 'text' | 'number' | 'email' | 'password',
    options?: {label:string, value:string}[],
    maxLength?: string
}) {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                ftype === 'normal' ? (
                    <FormItemNormal label={label} description={description} placeholder={placeholder} field={field} type={type} maxLength={maxLength} />
                ) : ftype === 'small' ? (
                    <FormItemSmall label={label} description={description} placeholder={placeholder} field={field} type={type} maxLength={maxLength} />
                ) : ftype === 'checkbox' ? (
                    <FormCheckbox label={label} field={field} />
                ) : ftype === 'select' ? (
                    <FormSelect label={label} options={options} field={field} />
                ) : ftype === 'vselect' ? (
                    <FormSelectVertical label={label} options={options} field={field} />
                ) : (
                    <FormItemVertical label={label} description={description} placeholder={placeholder} 
                    field={field} formControlClass={formControlClass} formLabelClass={formLabelClass} type={type} maxLength={maxLength} />
                )
            )}
        />
    )
}

export function FormItemNormal ({
    label, description, placeholder, field, type, maxLength
}:
{
    label:string, description?:string, placeholder?:string, field:any, type: 'text' | 'number' | 'email' | 'password', maxLength?: string
}) {
    return (
        <FormItem>
            {
                label && <FormLabel>{label}</FormLabel>
            }
            <FormControl>
                <Input placeholder={placeholder ?? 'N/A'} {...field} type={type} maxLength={maxLength} />
            </FormControl>
            {
                description && <FormDescription>{description}</FormDescription>
            }
            <FormMessage />
        </FormItem>
    )
}

export function FormItemVertical ({
    label, description, placeholder, field, formControlClass, formLabelClass, type, maxLength
}:
{
    label:string, description?:string, placeholder?:string, field:any, 
    formControlClass?:string, formLabelClass?:string, type?: 'text' | 'number' | 'email' | 'password', maxLength?: string
}) {
    return (
        <FormItem className="flex flex-col gap-1">
            <div className={`w-full text-sm ${formLabelClass}`}>{label}</div>
            <div className="flex items-center justify-center gap-3 w-full">
                <FormControl className={formControlClass}>
                    <Input placeholder={placeholder ?? 'N/A'} {...field} type={type} maxLength={maxLength} />
                </FormControl>
                {
                    description && <FormDescription>{description}</FormDescription>
                }
            </div>
            <FormMessage />
        </FormItem>
    )
}

export function FormItemSmall ({
    label, description, placeholder, field, type, maxLength
}:
{
    label:string, description?:string, placeholder?:string, field:any, type?: 'text' | 'number' | 'email' | 'password', maxLength?: string
}) {
    return (
        <FormItem className="flex flex-col w-11 gap-1">
            <FormLabel>{label}</FormLabel>
            <FormControl>
                <Input placeholder={placeholder ?? 'N/A'} {...field} type={type} maxLength={maxLength} />
            </FormControl>
            {
                description && <FormDescription>{description}</FormDescription>
            }
            <FormMessage />
        </FormItem>
    )
}

export function FormCheckbox ({
    label, field
}: {
    label:string, field:any
}) {
    return (
        <FormItem
                //key={item.id}
            className="flex flex-row items-start space-x-0 space-y-0 my-4"
            >
            <FormControl>
                <Checkbox
                    checked={field.value === "NO" ? false : true}
                    onCheckedChange={(checked) => {
                        return field.onChange(checked ? "YES" : "NO")
                    }}
                />
            </FormControl>
            <FormLabel className="text-sm font-normal">
                {label}
            </FormLabel>
            </FormItem>
    )
}

export function FormSelect ({
    label, options, field
}: {        
    label:string, options?: {label:string, value:string}[], field:any
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
                    {
                        options!.map((item, index) => (
                            <SelectItem key={index} value={item.value}>{item.label}</SelectItem>
                        ))
                    }
                    </SelectGroup>
                </SelectContent>
            </Select>
        </FormItem>
    )
}

export function FormSelectVertical ({
    label, options, field
}: {        
    label:string, options?: {label:string, value:string}[], field:any
}) {
    return (
        <FormItem className="flex flex-col gap-1">
            <div className={`w-full text-sm`}>
                {label}
            </div>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger className="">
                    <SelectValue placeholder={`Select ${label}`} />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                    <SelectLabel>{label}</SelectLabel>
                    {
                        options!.map((item, index) => (
                            <SelectItem key={index} value={item.value}>{item.label}</SelectItem>
                        ))
                    }
                    </SelectGroup>
                </SelectContent>
            </Select>
        </FormItem>
    )
}

