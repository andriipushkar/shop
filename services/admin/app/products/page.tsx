'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import api from '@/lib/api'
import { formatCurrency } from '@/lib/utils'
import { ProductModal } from './ProductModal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

export default function ProductsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, search],
    queryFn: () => api.getProducts({ page, limit: 20, search }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product deleted successfully')
      setDeleteProductId(null)
    },
  })

  const handleEdit = (product: any) => {
    setSelectedProduct(product)
    setIsModalOpen(true)
  }

  const handleCreate = () => {
    setSelectedProduct(null)
    setIsModalOpen(true)
  }

  const handleDelete = (id: string) => {
    setDeleteProductId(id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600">Manage your product catalog</p>
        </div>
        <button onClick={handleCreate} className="btn-primary flex items-center">
          <PlusIcon className="w-5 h-5 mr-2" />
          Add Product
        </button>
      </div>

      <div className="card">
        <div className="mb-6">
          <div className="relative max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
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
                    <th className="table-header">Product</th>
                    <th className="table-header">SKU</th>
                    <th className="table-header">Price</th>
                    <th className="table-header">Stock</th>
                    <th className="table-header">Status</th>
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data?.items?.map((product: any) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="table-cell">
                        <div className="flex items-center">
                          {product.images?.[0] && (
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="w-10 h-10 rounded-lg object-cover mr-3"
                            />
                          )}
                          <div>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-gray-500">{product.category_name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell text-gray-500">{product.sku}</td>
                      <td className="table-cell">
                        <div>{formatCurrency(product.price)}</div>
                        {product.compare_price && (
                          <div className="text-sm text-gray-500 line-through">
                            {formatCurrency(product.compare_price)}
                          </div>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className={product.quantity <= 5 ? 'text-red-600 font-medium' : ''}>
                          {product.quantity}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            product.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        <button
                          onClick={() => handleEdit(product)}
                          className="p-1 text-gray-400 hover:text-primary-600"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-1 text-gray-400 hover:text-red-600 ml-2"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
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

      <ProductModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <ConfirmDialog
        isOpen={!!deleteProductId}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => deleteProductId && deleteMutation.mutate(deleteProductId)}
        onCancel={() => setDeleteProductId(null)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
