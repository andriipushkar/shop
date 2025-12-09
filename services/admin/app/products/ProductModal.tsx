'use client'

import { Fragment, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import api, { ProductInput } from '@/lib/api'
import { slugify } from '@/lib/utils'
import toast from 'react-hot-toast'

interface ProductModalProps {
  product?: any
  isOpen: boolean
  onClose: () => void
}

export function ProductModal({ product, isOpen, onClose }: ProductModalProps) {
  const queryClient = useQueryClient()

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.getCategories({ limit: 100 }),
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductInput>()

  const name = watch('name')

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        compare_price: product.compare_price,
        sku: product.sku,
        quantity: product.quantity,
        category_id: product.category_id,
        is_active: product.is_active,
      })
    } else {
      reset({
        name: '',
        slug: '',
        description: '',
        price: 0,
        compare_price: undefined,
        sku: '',
        quantity: 0,
        category_id: '',
        is_active: true,
      })
    }
  }, [product, reset])

  useEffect(() => {
    if (!product && name) {
      setValue('slug', slugify(name))
    }
  }, [name, product, setValue])

  const createMutation = useMutation({
    mutationFn: (data: ProductInput) => api.createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product created successfully')
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: ProductInput) => api.updateProduct(product.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product updated successfully')
      onClose()
    },
  })

  const onSubmit = (data: ProductInput) => {
    if (product) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    {product ? 'Edit Product' : 'Create Product'}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Name</label>
                      <input
                        {...register('name', { required: 'Name is required' })}
                        className="input"
                        placeholder="Product name"
                      />
                      {errors.name && (
                        <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="label">Slug</label>
                      <input
                        {...register('slug', { required: 'Slug is required' })}
                        className="input"
                        placeholder="product-slug"
                      />
                      {errors.slug && (
                        <p className="text-sm text-red-600 mt-1">{errors.slug.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="label">Description</label>
                    <textarea
                      {...register('description')}
                      className="input"
                      rows={3}
                      placeholder="Product description"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="label">Price</label>
                      <input
                        {...register('price', {
                          required: 'Price is required',
                          valueAsNumber: true,
                          min: { value: 0, message: 'Price must be positive' },
                        })}
                        type="number"
                        step="0.01"
                        className="input"
                        placeholder="0.00"
                      />
                      {errors.price && (
                        <p className="text-sm text-red-600 mt-1">{errors.price.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="label">Compare Price</label>
                      <input
                        {...register('compare_price', { valueAsNumber: true })}
                        type="number"
                        step="0.01"
                        className="input"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="label">SKU</label>
                      <input
                        {...register('sku', { required: 'SKU is required' })}
                        className="input"
                        placeholder="SKU-001"
                      />
                      {errors.sku && (
                        <p className="text-sm text-red-600 mt-1">{errors.sku.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Quantity</label>
                      <input
                        {...register('quantity', {
                          required: 'Quantity is required',
                          valueAsNumber: true,
                          min: { value: 0, message: 'Quantity must be positive' },
                        })}
                        type="number"
                        className="input"
                        placeholder="0"
                      />
                      {errors.quantity && (
                        <p className="text-sm text-red-600 mt-1">{errors.quantity.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="label">Category</label>
                      <select
                        {...register('category_id', { required: 'Category is required' })}
                        className="input"
                      >
                        <option value="">Select category</option>
                        {categories?.items?.map((cat: any) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      {errors.category_id && (
                        <p className="text-sm text-red-600 mt-1">{errors.category_id.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      {...register('is_active')}
                      type="checkbox"
                      id="is_active"
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
                      Active
                    </label>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button type="button" onClick={onClose} className="btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" disabled={isLoading} className="btn-primary">
                      {isLoading ? 'Saving...' : product ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
