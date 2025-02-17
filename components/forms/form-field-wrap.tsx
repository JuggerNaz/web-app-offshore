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

export function FormFieldWrap ({
    label, name, form, description, 
    placeholder, type = 'normal', formControlClass = '', formLabelClass = ''
}
:
{
    label:string, 
    name:string, 
    form:any, 
    description?:string, 
    placeholder?:string, 
    type?: 'normal' | 'small' | 'vertical' | 'checkbox',
    formControlClass?: string,
    formLabelClass?: string
}) {
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                type === 'normal' ? (
                    <FormItemNormal label={label} description={description} placeholder={placeholder} field={field} />
                ) : type === 'small' ? (
                    <FormItemSmall label={label} description={description} placeholder={placeholder} field={field} />
                ) : type === 'checkbox' ? (
                    <FormCheckbox label={label} field={field} />
                )  : (
                    <FormItemVertical label={label} description={description} placeholder={placeholder} 
                    field={field} formControlClass={formControlClass} formLabelClass={formLabelClass} />
                )
            )}
        />
    )
}

export function FormItemNormal ({
    label, description, placeholder, field
}:
{
    label:string, description?:string, placeholder?:string, field:any
}) {
    return (
        <FormItem>
            <FormLabel>{label}</FormLabel>
            <FormControl>
                <Input placeholder={placeholder ?? 'N/A'} {...field} />
            </FormControl>
            {
                description && <FormDescription>{description}</FormDescription>
            }
            <FormMessage />
        </FormItem>
    )
}

export function FormItemVertical ({
    label, description, placeholder, field, formControlClass, formLabelClass
}:
{
    label:string, description?:string, placeholder?:string, field:any, 
    formControlClass?:string, formLabelClass?:string
}) {
    return (
        <FormItem className="flex flex-col gap-1">
            <div className={`w-full text-sm ${formLabelClass}`}>{label}</div>
            <div className="flex items-center justify-center gap-3 w-full">
                <FormControl className={formControlClass}>
                    <Input placeholder={placeholder ?? 'N/A'} {...field} />
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
    label, description, placeholder, field
}:
{
    label:string, description?:string, placeholder?:string, field:any
}) {
    return (
        <FormItem className="flex flex-col w-11 gap-1">
            <FormLabel>{label}</FormLabel>
            <FormControl>
                <Input placeholder={placeholder ?? 'N/A'} {...field} />
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

