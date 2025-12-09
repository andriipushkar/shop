'use client'

import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { formatCurrency, formatDateTime } from '@/lib/utils'

interface OrderDetailModalProps {
  order: any
  isOpen: boolean
  onClose: () => void
}

export function OrderDetailModal({ order, isOpen, onClose }: OrderDetailModalProps) {
  if (!order) return null

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
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                <div className="flex items-center justify-between mb-6">
                  <Dialog.Title className="text-lg font-semibold text-gray-900">
                    Order #{order.id.slice(0, 8)}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XMarkIcon className="w-6 h-6" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Customer Info</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>{order.customer_name || '-'}</p>
                      <p>{order.customer_email}</p>
                      <p>{order.customer_phone}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">Shipping Address</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>{order.shipping_address?.street}</p>
                      <p>
                        {order.shipping_address?.city}, {order.shipping_address?.state}{' '}
                        {order.shipping_address?.postal_code}
                      </p>
                      <p>{order.shipping_address?.country}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="font-medium text-gray-900 mb-4">Order Items</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="table-header">Product</th>
                          <th className="table-header">Price</th>
                          <th className="table-header">Quantity</th>
                          <th className="table-header text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {order.items?.map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td className="table-cell">
                              <div className="flex items-center">
                                {item.image && (
                                  <img
                                    src={item.image}
                                    alt={item.name}
                                    className="w-10 h-10 rounded object-cover mr-3"
                                  />
                                )}
                                <span>{item.name}</span>
                              </div>
                            </td>
                            <td className="table-cell">{formatCurrency(item.price)}</td>
                            <td className="table-cell">{item.quantity}</td>
                            <td className="table-cell text-right">
                              {formatCurrency(item.price * item.quantity)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-end">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span>{formatCurrency(order.subtotal || order.total)}</span>
                      </div>
                      {order.discount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Discount</span>
                          <span className="text-green-600">
                            -{formatCurrency(order.discount)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Shipping</span>
                        <span>{formatCurrency(order.shipping_cost || 0)}</span>
                      </div>
                      <div className="flex justify-between font-medium text-lg pt-2 border-t">
                        <span>Total</span>
                        <span>{formatCurrency(order.total)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t">
                  <div className="text-sm text-gray-500">
                    Created: {formatDateTime(order.created_at)}
                  </div>
                  <button onClick={onClose} className="btn-secondary">
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
