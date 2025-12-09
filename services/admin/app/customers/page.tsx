'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MagnifyingGlassIcon, EyeIcon } from '@heroicons/react/24/outline'
import api from '@/lib/api'
import { formatDateTime, formatCurrency } from '@/lib/utils'
import Link from 'next/link'

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, search],
    queryFn: () => api.getCustomers({ page, limit: 20, search }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="text-gray-600">Manage your customer base</p>
      </div>

      <div className="card">
        <div className="mb-6">
          <div className="relative max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-header">Customer</th>
                    <th className="table-header">Contact</th>
                    <th className="table-header">Orders</th>
                    <th className="table-header">Total Spent</th>
                    <th className="table-header">Joined</th>
                    <th className="table-header">Status</th>
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data?.items?.map((customer: any) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="table-cell">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-primary-700 font-medium">
                              {customer.first_name?.[0] || customer.email[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium">
                              {customer.first_name} {customer.last_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {customer.id.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell">
                        <div>{customer.email}</div>
                        <div className="text-sm text-gray-500">{customer.phone}</div>
                      </td>
                      <td className="table-cell">{customer.orders_count || 0}</td>
                      <td className="table-cell">
                        {formatCurrency(customer.total_spent || 0)}
                      </td>
                      <td className="table-cell text-gray-500">
                        {formatDateTime(customer.created_at)}
                      </td>
                      <td className="table-cell">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            customer.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {customer.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="p-1 text-gray-400 hover:text-primary-600 inline-block"
                        >
                          <EyeIcon className="w-5 h-5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data?.total_pages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-700">
                  Showing page {page} of {data.total_pages}
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-secondary disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= data.total_pages}
                    className="btn-secondary disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
