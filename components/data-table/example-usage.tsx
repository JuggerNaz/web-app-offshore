// Example usage of DataTable with pagination, search, and filtering

import { DataTable } from "./data-table";
import { columns } from "./columns";

// Basic usage with all features enabled (default)
export function BasicTable({ data }: { data: any[] }) {
  return <DataTable columns={columns} data={data} />;
}

// Custom page size with search
export function SearchableTable({ data }: { data: any[] }) {
  return <DataTable columns={columns} data={data} pageSize={20} enableGlobalFilter={true} />;
}

// Table without search but with sorting
export function SortableOnlyTable({ data }: { data: any[] }) {
  return (
    <DataTable columns={columns} data={data} enableGlobalFilter={false} enableSorting={true} />
  );
}

// Minimal table (no pagination, no search, no sorting)
export function MinimalTable({ data }: { data: any[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      enablePagination={false}
      enableGlobalFilter={false}
      enableSorting={false}
    />
  );
}

// Fully featured table with custom configuration
export function AdvancedTable({ data }: { data: any[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      pageSize={15}
      disableRowClick={false}
      enablePagination={true}
      enableGlobalFilter={true}
      enableColumnFilters={true}
      enableSorting={true}
    />
  );
}

// Read-only table with search but no row interactions
export function ReadOnlySearchableTable({ data }: { data: any[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      disableRowClick={true}
      enableGlobalFilter={true}
      enableSorting={true}
    />
  );
}
