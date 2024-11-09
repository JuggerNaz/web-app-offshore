"use server"

import { useState, useEffect, use } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { createClient } from "@/utils/supabase/server";
import { Server } from 'lucide-react';

// export function useFetchModules<TData, TValue>(
//   fetcher: () => Promise<TData[]>,
//   columns: ColumnDef<TData, TValue>[]
// ) {
//   const [data, setData] = useState<TData[]>([])
//   const [loading, setLoading] = useState(true)

//   useEffect(() => {
//     fetcher().then((data) => {
//       setData(data)
//       setLoading(false)
//     })
//   }, [fetcher])

//   return { data, loading, columns }
// }

// export function useFetchModules() {
//   const [modules, setModules] = useState([])
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState(null)
//   const supabase = createClient();

//   useEffect(() => {
//     const fetchModules = async () => {
//       try {
//         let { data: module, error } = await supabase.from('modules').select('*')
//         if (error) throw error
//         //setModules(data)
//         console.log(module)
//       } catch (error) {
//         //setError(error)
//       } finally {
//         setLoading(false)
//       }
//     }
//     fetchModules()
//   }, [])

//   return { modules, loading, error }
// }