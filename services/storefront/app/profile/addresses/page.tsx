'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    MapPinIcon,
    PlusIcon,
    PencilIcon,
    TrashIcon,
    CheckCircleIcon,
    HomeIcon,
    BuildingOfficeIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

interface Address {
    id: string;
    name: string;
    type: 'home' | 'work' | 'other';
    city: string;
    deliveryMethod: 'branch' | 'postomat' | 'courier';
    branchNumber?: string;
    street?: string;
    building?: string;
    apartment?: string;
    phone: string;
    isDefault: boolean;
}

const mockAddresses: Address[] = [
    {
        id: '1',
        name: 'Дім',
        type: 'home',
        city: 'Київ',
        deliveryMethod: 'branch',
        branchNumber: '25',
        phone: '+380 67 123 45 67',
        isDefault: true,
    },
    {
        id: '2',
        name: 'Робота',
        type: 'work',
        city: 'Київ',
        deliveryMethod: 'courier',
        street: 'вул. Хрещатик',
        building: '22',
        apartment: '10',
        phone: '+380 67 123 45 67',
        isDefault: false,
    },
    {
        id: '3',
        name: 'Батьки',
        type: 'other',
        city: 'Львів',
        deliveryMethod: 'postomat',
        branchNumber: '112',
        phone: '+380 50 987 65 43',
        isDefault: false,
    },
];

const deliveryMethodLabels = {
    branch: 'Відділення Нової Пошти',
    postomat: 'Поштомат',
    courier: "Кур'єр",
};

const typeIcons = {
    home: HomeIcon,
    work: BuildingOfficeIcon,
    other: MapPinIcon,
};

export default function AddressesPage() {
    const [addresses, setAddresses] = useState<Address[]>(mockAddresses);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAddress, setEditingAddress] = useState<Address | null>(null);
    const [formData, setFormData] = useState<Partial<Address>>({
        name: '',
        type: 'home',
        city: '',
        deliveryMethod: 'branch',
        branchNumber: '',
        street: '',
        building: '',
        apartment: '',
        phone: '',
        isDefault: false,
    });

    const handleOpenModal = (address?: Address) => {
        if (address) {
            setEditingAddress(address);
            setFormData(address);
        } else {
            setEditingAddress(null);
            setFormData({
                name: '',
                type: 'home',
                city: '',
                deliveryMethod: 'branch',
                branchNumber: '',
                street: '',
                building: '',
                apartment: '',
                phone: '',
                isDefault: false,
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingAddress(null);
    };

    const handleSave = () => {
        if (editingAddress) {
            setAddresses(prev => prev.map(addr =>
                addr.id === editingAddress.id
                    ? { ...addr, ...formData, id: addr.id }
                    : formData.isDefault ? { ...addr, isDefault: false } : addr
            ));
        } else {
            const newAddress: Address = {
                ...formData as Address,
                id: Date.now().toString(),
            };
            if (newAddress.isDefault) {
                setAddresses(prev => [...prev.map(a => ({ ...a, isDefault: false })), newAddress]);
            } else {
                setAddresses(prev => [...prev, newAddress]);
            }
        }
        handleCloseModal();
    };

    const handleDelete = (id: string) => {
        if (confirm('Ви впевнені, що хочете видалити цю адресу?')) {
            setAddresses(prev => prev.filter(addr => addr.id !== id));
        }
    };

    const handleSetDefault = (id: string) => {
        setAddresses(prev => prev.map(addr => ({
            ...addr,
            isDefault: addr.id === id,
        })));
    };

    const getAddressString = (address: Address) => {
        if (address.deliveryMethod === 'courier') {
            return `${address.street}, ${address.building}${address.apartment ? `, кв. ${address.apartment}` : ''}`;
        }
        return `${deliveryMethodLabels[address.deliveryMethod]} №${address.branchNumber}`;
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                {/* Header */}
                <div className="mb-6">
                    <nav className="text-sm text-gray-500 mb-2">
                        <Link href="/" className="hover:text-teal-600">Головна</Link>
                        <span className="mx-2">/</span>
                        <Link href="/profile" className="hover:text-teal-600">Профіль</Link>
                        <span className="mx-2">/</span>
                        <span className="text-gray-900">Адреси доставки</span>
                    </nav>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Адреси доставки</h1>
                            <p className="text-gray-600">Керуйте збереженими адресами для швидкого оформлення</p>
                        </div>
                        <button
                            onClick={() => handleOpenModal()}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Додати адресу
                        </button>
                    </div>
                </div>

                {/* Addresses list */}
                {addresses.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm p-12 text-center">
                        <MapPinIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Немає збережених адрес</h3>
                        <p className="text-gray-500 mb-6">Додайте адресу для швидкого оформлення замовлень</p>
                        <button
                            onClick={() => handleOpenModal()}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Додати першу адресу
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {addresses.map((address) => {
                            const TypeIcon = typeIcons[address.type];
                            return (
                                <div
                                    key={address.id}
                                    className={`bg-white rounded-xl shadow-sm p-4 border-2 transition-colors ${
                                        address.isDefault ? 'border-teal-500' : 'border-transparent'
                                    }`}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                            address.isDefault ? 'bg-teal-100' : 'bg-gray-100'
                                        }`}>
                                            <TypeIcon className={`w-6 h-6 ${
                                                address.isDefault ? 'text-teal-600' : 'text-gray-500'
                                            }`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-gray-900">{address.name}</h3>
                                                {address.isDefault && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-700 text-xs font-medium rounded-full">
                                                        <CheckCircleIcon className="w-3.5 h-3.5" />
                                                        За замовчуванням
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-gray-600">{address.city}</p>
                                            <p className="text-gray-600">{getAddressString(address)}</p>
                                            <p className="text-sm text-gray-500 mt-1">{address.phone}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!address.isDefault && (
                                                <button
                                                    onClick={() => handleSetDefault(address.id)}
                                                    className="px-3 py-1.5 text-sm text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                                >
                                                    Зробити основною
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleOpenModal(address)}
                                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                <PencilIcon className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(address.id)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Info */}
                <div className="mt-6 bg-blue-50 rounded-xl p-4">
                    <p className="text-sm text-blue-800">
                        💡 <strong>Підказка:</strong> Адреса за замовчуванням буде автоматично обрана при оформленні замовлення
                    </p>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
                        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={handleCloseModal} />
                        <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6 text-left overflow-hidden transform transition-all">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-gray-900">
                                    {editingAddress ? 'Редагувати адресу' : 'Нова адреса'}
                                </h2>
                                <button
                                    onClick={handleCloseModal}
                                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                                >
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Назва адреси
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="Дім, Робота, тощо"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>

                                {/* Type */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Тип адреси
                                    </label>
                                    <div className="flex gap-2">
                                        {(['home', 'work', 'other'] as const).map((type) => {
                                            const Icon = typeIcons[type];
                                            const labels = { home: 'Дім', work: 'Робота', other: 'Інше' };
                                            return (
                                                <button
                                                    key={type}
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, type }))}
                                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                                                        formData.type === type
                                                            ? 'border-teal-500 bg-teal-50 text-teal-700'
                                                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <Icon className="w-5 h-5" />
                                                    {labels[type]}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* City */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Місто
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.city || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                                        placeholder="Введіть місто"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>

                                {/* Delivery method */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Спосіб доставки
                                    </label>
                                    <select
                                        value={formData.deliveryMethod || 'branch'}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            deliveryMethod: e.target.value as Address['deliveryMethod'],
                                        }))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    >
                                        <option value="branch">Відділення Нової Пошти</option>
                                        <option value="postomat">Поштомат</option>
                                        <option value="courier">Кур&apos;єр</option>
                                    </select>
                                </div>

                                {/* Branch/Postomat number or Address */}
                                {formData.deliveryMethod === 'courier' ? (
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-3">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Вулиця
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.street || ''}
                                                onChange={(e) => setFormData(prev => ({ ...prev, street: e.target.value }))}
                                                placeholder="вул. Хрещатик"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Будинок
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.building || ''}
                                                onChange={(e) => setFormData(prev => ({ ...prev, building: e.target.value }))}
                                                placeholder="22"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Квартира (опціонально)
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.apartment || ''}
                                                onChange={(e) => setFormData(prev => ({ ...prev, apartment: e.target.value }))}
                                                placeholder="10"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Номер {formData.deliveryMethod === 'branch' ? 'відділення' : 'поштомату'}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.branchNumber || ''}
                                            onChange={(e) => setFormData(prev => ({ ...prev, branchNumber: e.target.value }))}
                                            placeholder="25"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        />
                                    </div>
                                )}

                                {/* Phone */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Телефон одержувача
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.phone || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        placeholder="+380 67 123 45 67"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                </div>

                                {/* Default checkbox */}
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.isDefault || false}
                                        onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                                        className="w-5 h-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    <span className="text-gray-700">Зробити адресою за замовчуванням</span>
                                </label>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    Скасувати
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!formData.name || !formData.city || !formData.phone}
                                    className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {editingAddress ? 'Зберегти' : 'Додати'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
