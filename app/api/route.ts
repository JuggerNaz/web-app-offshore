// export async function getModules() {
//     const res = await fetch(`${API_URL}/modules`)
//     const data = await res.json()
//     return data
// }

import { NextResponse } from "next/server"

export async function GET() {
    return NextResponse.json({ message: "Hello World" })
}