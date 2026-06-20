import React from 'react'

export interface DataTableProps<T> {
  data: T[]
  columns: { header: string; accessor: keyof T | ((row: T) => React.ReactNode) }[]
}

export function DataTable<T>({ data, columns }: DataTableProps<T>) {
  return (
    <table>
      <thead>
        <tr>
          {columns.map((col, i) => (
            <th key={i}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {columns.map((col, j) => (
              <td key={j}>
                {typeof col.accessor === 'function'
                  ? col.accessor(row)
                  : (row[col.accessor] as React.ReactNode)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
