import { Payment, columns } from "./columns"
import { DataTable } from "./data-table"
import { fetchModules, fetchModulesWithCategoryAndType } from "@/utils/actions/module"
 
async function getData(): Promise<Payment[]> {
  // Fetch data from your API here.
  return [
    {
        id: "7ased52f",
        amount: 300,
        status: "pending",
        email: "mytest@example.com",
    },
    {
        id: "728ed52f",
        amount: 100,
        status: "pending",
        email: "m@example.com",
    },
    {
        id: "489e1d42",
        amount: 125,
        status: "processing",
        email: "example@gmail.com",
    },
    // ...
  ]
}
  
  export const payments: Payment[] = [
    {
      id: "728ed52f",
      amount: 100,
      status: "pending",
      email: "m@example.com",
    },
    {
      id: "489e1d42",
      amount: 125,
      status: "processing",
      email: "example@gmail.com",
    },
    // ...
  ]  

export default async function PlatformPage() {
    const data = await getData()
    
    const modules = await fetchModules()
    //console.log(modules)
    const modulesWithCategoryAndType = await fetchModulesWithCategoryAndType()
    return (
      <div className="flex-1 w-full flex flex-col">
        <div className="flex flex-col items-start">
          <h2 className="font-bold text-2xl">Platform</h2>
        </div>
        <div className="container mx-auto py-10">
            <DataTable columns={columns} data={modules?.data!} />
        </div>
      </div>
    );
  }