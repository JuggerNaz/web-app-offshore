//this is just temporary types until can generate them from supabase

export type User = {
    id: string
    email: string
    first_name: string
    last_name: string
    role: string
    created_at: string
}

export type Module = {
    id: string
    name: string
    data: {}
    created_at: string
}

export type Module_Category = {
    id: string
    name: string
    created_at: string
}

export type Module_Type = {
    id: string
    name: string
    created_at: string
}