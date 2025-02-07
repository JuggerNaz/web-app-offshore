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

export function FormFieldWrap ({
    label, name, form, description, placeholder, type = 'normal'
}
:
{
    label:string, 
    name:string, 
    form:any, 
    description?:string, 
    placeholder?:string, type?: 'normal' | 'small' | 'vertical'
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
                ) : (
                    <FormItemVertical label={label} description={description} placeholder={placeholder} field={field} />
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
    label, description, placeholder, field
}:
{
    label:string, description?:string, placeholder?:string, field:any
}) {
    return (
        <FormItem className="flex flex-col">
            <div>{label}</div>
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

