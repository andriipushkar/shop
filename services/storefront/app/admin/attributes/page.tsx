'use client';

import { useState } from 'react';
import {
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    TagIcon,
    AdjustmentsHorizontalIcon,
    SwatchIcon,
    MagnifyingGlassIcon,
    ChevronDownIcon,
    XMarkIcon,
    FunnelIcon,
    Squares2X2Icon,
    CheckCircleIcon,
    DocumentDuplicateIcon,
    LinkIcon,
} from '@heroicons/react/24/outline';

// Types
type AttributeType = 'text' | 'number' | 'select' | 'multiselect' | 'bool' | 'color' | 'range';

interface AttributeOption {
    id: string;
    value: string;
    label: { uk: string; en: string };
    colorHex?: string;
}

interface Attribute {
    id: string;
    code: string;
    name: { uk: string; en: string };
    type: AttributeType;
    unit?: string;
    isFilterable: boolean;
    isSearchable: boolean;
    isComparable: boolean;
    isVisible: boolean;
    options?: AttributeOption[];
    usedInCategories: number;
    usedInProducts: number;
}

interface AttributeGroup {
    id: string;
    code: string;
    name: { uk: string; en: string };
    attributeCount: number;
}

// Mock data
const attributeGroups: AttributeGroup[] = [
    { id: '1', code: 'general', name: { uk: 'Загальні', en: 'General' }, attributeCount: 4 },
    { id: '2', code: 'technical', name: { uk: 'Технічні', en: 'Technical' }, attributeCount: 15 },
    { id: '3', code: 'physical', name: { uk: 'Фізичні', en: 'Physical' }, attributeCount: 8 },
    { id: '4', code: 'fashion', name: { uk: 'Мода', en: 'Fashion' }, attributeCount: 12 },
];

const attributesData: Attribute[] = [
    {
        id: '1',
        code: 'brand',
        name: { uk: 'Бренд', en: 'Brand' },
        type: 'select',
        isFilterable: true,
        isSearchable: true,
        isComparable: true,
        isVisible: true,
        usedInCategories: 12,
        usedInProducts: 456,
        options: [
            { id: '1', value: 'apple', label: { uk: 'Apple', en: 'Apple' } },
            { id: '2', value: 'samsung', label: { uk: 'Samsung', en: 'Samsung' } },
            { id: '3', value: 'nike', label: { uk: 'Nike', en: 'Nike' } },
        ],
    },
    {
        id: '2',
        code: 'color',
        name: { uk: 'Колір', en: 'Color' },
        type: 'color',
        isFilterable: true,
        isSearchable: true,
        isComparable: true,
        isVisible: true,
        usedInCategories: 15,
        usedInProducts: 1234,
        options: [
            { id: '1', value: 'black', label: { uk: 'Чорний', en: 'Black' }, colorHex: '#000000' },
            { id: '2', value: 'white', label: { uk: 'Білий', en: 'White' }, colorHex: '#FFFFFF' },
            { id: '3', value: 'red', label: { uk: 'Червоний', en: 'Red' }, colorHex: '#FF0000' },
        ],
    },
    {
        id: '3',
        code: 'screen_diag',
        name: { uk: 'Діагональ екрану', en: 'Screen Diagonal' },
        type: 'number',
        unit: 'дюйм',
        isFilterable: true,
        isSearchable: false,
        isComparable: true,
        isVisible: true,
        usedInCategories: 3,
        usedInProducts: 89,
    },
    {
        id: '4',
        code: 'ram',
        name: { uk: "Оперативна пам'ять", en: 'RAM' },
        type: 'select',
        unit: 'ГБ',
        isFilterable: true,
        isSearchable: true,
        isComparable: true,
        isVisible: true,
        usedInCategories: 2,
        usedInProducts: 67,
        options: [
            { id: '1', value: '4', label: { uk: '4 ГБ', en: '4 GB' } },
            { id: '2', value: '8', label: { uk: '8 ГБ', en: '8 GB' } },
            { id: '3', value: '16', label: { uk: '16 ГБ', en: '16 GB' } },
        ],
    },
    {
        id: '5',
        code: 'nfc',
        name: { uk: 'Наявність NFC', en: 'NFC Support' },
        type: 'bool',
        isFilterable: true,
        isSearchable: false,
        isComparable: true,
        isVisible: true,
        usedInCategories: 1,
        usedInProducts: 45,
    },
    {
        id: '6',
        code: 'clothing_size',
        name: { uk: 'Розмір одягу', en: 'Clothing Size' },
        type: 'select',
        isFilterable: true,
        isSearchable: true,
        isComparable: true,
        isVisible: true,
        usedInCategories: 8,
        usedInProducts: 567,
        options: [
            { id: '1', value: 'xs', label: { uk: 'XS', en: 'XS' } },
            { id: '2', value: 's', label: { uk: 'S', en: 'S' } },
            { id: '3', value: 'm', label: { uk: 'M', en: 'M' } },
            { id: '4', value: 'l', label: { uk: 'L', en: 'L' } },
            { id: '5', value: 'xl', label: { uk: 'XL', en: 'XL' } },
        ],
    },
];

const typeLabels: Record<AttributeType, { label: string; icon: React.ReactNode; color: string }> = {
    text: { label: 'Текст', icon: <TagIcon className="w-4 h-4" />, color: 'bg-gray-100 text-gray-700' },
    number: { label: 'Число', icon: <AdjustmentsHorizontalIcon className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700' },
    select: { label: 'Список', icon: <ChevronDownIcon className="w-4 h-4" />, color: 'bg-purple-100 text-purple-700' },
    multiselect: { label: 'Мультисписок', icon: <Squares2X2Icon className="w-4 h-4" />, color: 'bg-indigo-100 text-indigo-700' },
    bool: { label: 'Так/Ні', icon: <CheckCircleIcon className="w-4 h-4" />, color: 'bg-green-100 text-green-700' },
    color: { label: 'Колір', icon: <SwatchIcon className="w-4 h-4" />, color: 'bg-pink-100 text-pink-700' },
    range: { label: 'Діапазон', icon: <AdjustmentsHorizontalIcon className="w-4 h-4" />, color: 'bg-orange-100 text-orange-700' },
};

export default function AttributesPage() {
    const [attributes, setAttributes] = useState(attributesData);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedType, setSelectedType] = useState<AttributeType | 'all'>('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editAttribute, setEditAttribute] = useState<Attribute | null>(null);
    const [activeTab, setActiveTab] = useState<'attributes' | 'groups'>('attributes');
    const [expandedAttribute, setExpandedAttribute] = useState<string | null>(null);

    // Form state for new/edit attribute
    const [formData, setFormData] = useState<{
        code: string;
        nameUk: string;
        nameEn: string;
        type: AttributeType;
        unit: string;
        isFilterable: boolean;
        isSearchable: boolean;
        isComparable: boolean;
        isVisible: boolean;
        options: { value: string; labelUk: string; labelEn: string; colorHex: string }[];
    }>({
        code: '',
        nameUk: '',
        nameEn: '',
        type: 'text',
        unit: '',
        isFilterable: true,
        isSearchable: true,
        isComparable: true,
        isVisible: true,
        options: [],
    });

    const filteredAttributes = attributes.filter(attr => {
        const matchesSearch = searchQuery === '' ||
            attr.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            attr.name.uk.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = selectedType === 'all' || attr.type === selectedType;
        return matchesSearch && matchesType;
    });

    const openEditModal = (attr: Attribute) => {
        setEditAttribute(attr);
        setFormData({
            code: attr.code,
            nameUk: attr.name.uk,
            nameEn: attr.name.en,
            type: attr.type,
            unit: attr.unit || '',
            isFilterable: attr.isFilterable,
            isSearchable: attr.isSearchable,
            isComparable: attr.isComparable,
            isVisible: attr.isVisible,
            options: attr.options?.map(o => ({
                value: o.value,
                labelUk: o.label.uk,
                labelEn: o.label.en,
                colorHex: o.colorHex || '',
            })) || [],
        });
        setShowAddModal(true);
    };

    const openAddModal = () => {
        setEditAttribute(null);
        setFormData({
            code: '',
            nameUk: '',
            nameEn: '',
            type: 'text',
            unit: '',
            isFilterable: true,
            isSearchable: true,
            isComparable: true,
            isVisible: true,
            options: [],
        });
        setShowAddModal(true);
    };

    const addOption = () => {
        setFormData({
            ...formData,
            options: [...formData.options, { value: '', labelUk: '', labelEn: '', colorHex: '' }],
        });
    };

    const removeOption = (index: number) => {
        setFormData({
            ...formData,
            options: formData.options.filter((_, i) => i !== index),
        });
    };

    const updateOption = (index: number, field: string, value: string) => {
        const newOptions = [...formData.options];
        newOptions[index] = { ...newOptions[index], [field]: value };
        setFormData({ ...formData, options: newOptions });
    };

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Атрибути товарів</h1>
                    <p className="text-gray-600">Керування характеристиками та фільтрами</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                >
                    <PlusIcon className="w-5 h-5" />
                    Додати атрибут
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                            <TagIcon className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{attributes.length}</p>
                            <p className="text-sm text-gray-500">Всього атрибутів</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <FunnelIcon className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">
                                {attributes.filter(a => a.isFilterable).length}
                            </p>
                            <p className="text-sm text-gray-500">Фільтрів</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Squares2X2Icon className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{attributeGroups.length}</p>
                            <p className="text-sm text-gray-500">Груп</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <SwatchIcon className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">
                                {attributes.reduce((sum, a) => sum + (a.options?.length || 0), 0)}
                            </p>
                            <p className="text-sm text-gray-500">Опцій</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex gap-6">
                    <button
                        onClick={() => setActiveTab('attributes')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'attributes'
                                ? 'border-teal-500 text-teal-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Атрибути
                    </button>
                    <button
                        onClick={() => setActiveTab('groups')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === 'groups'
                                ? 'border-teal-500 text-teal-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        Групи
                    </button>
                </nav>
            </div>

            {activeTab === 'attributes' && (
                <>
                    {/* Search and filters */}
                    <div className="bg-white rounded-xl shadow-sm p-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            <div className="relative flex-1">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Пошук атрибутів..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                />
                            </div>
                            <select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value as AttributeType | 'all')}
                                className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            >
                                <option value="all">Всі типи</option>
                                {Object.entries(typeLabels).map(([type, { label }]) => (
                                    <option key={type} value={type}>{label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Attributes list */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Атрибут
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Тип
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Опції
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Використання
                                        </th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Властивості
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Дії
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredAttributes.map((attr) => (
                                        <tr key={attr.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p className="font-medium text-gray-900">{attr.name.uk}</p>
                                                    <p className="text-sm text-gray-500 font-mono">{attr.code}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${typeLabels[attr.type].color}`}>
                                                    {typeLabels[attr.type].icon}
                                                    {typeLabels[attr.type].label}
                                                    {attr.unit && <span className="text-gray-500">({attr.unit})</span>}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {attr.options && attr.options.length > 0 ? (
                                                    <button
                                                        onClick={() => setExpandedAttribute(
                                                            expandedAttribute === attr.id ? null : attr.id
                                                        )}
                                                        className="text-sm text-teal-600 hover:text-teal-700"
                                                    >
                                                        {attr.options.length} опцій
                                                        <ChevronDownIcon className={`inline w-4 h-4 ml-1 transition-transform ${
                                                            expandedAttribute === attr.id ? 'rotate-180' : ''
                                                        }`} />
                                                    </button>
                                                ) : (
                                                    <span className="text-sm text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-sm text-gray-900">{attr.usedInCategories} кат.</span>
                                                    <span className="text-xs text-gray-500">{attr.usedInProducts} товарів</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-1">
                                                    {attr.isFilterable && (
                                                        <span className="w-6 h-6 bg-purple-100 rounded flex items-center justify-center" title="Фільтр">
                                                            <FunnelIcon className="w-3.5 h-3.5 text-purple-600" />
                                                        </span>
                                                    )}
                                                    {attr.isSearchable && (
                                                        <span className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center" title="Пошук">
                                                            <MagnifyingGlassIcon className="w-3.5 h-3.5 text-blue-600" />
                                                        </span>
                                                    )}
                                                    {attr.isComparable && (
                                                        <span className="w-6 h-6 bg-green-100 rounded flex items-center justify-center" title="Порівняння">
                                                            <DocumentDuplicateIcon className="w-3.5 h-3.5 text-green-600" />
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => openEditModal(attr)}
                                                        className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                    >
                                                        <PencilSquareIcon className="w-5 h-5" />
                                                    </button>
                                                    <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Expanded options */}
                        {expandedAttribute && (
                            <div className="border-t bg-gray-50 px-6 py-4">
                                <p className="text-sm font-medium text-gray-700 mb-3">Опції атрибута:</p>
                                <div className="flex flex-wrap gap-2">
                                    {attributes.find(a => a.id === expandedAttribute)?.options?.map((opt) => (
                                        <span
                                            key={opt.id}
                                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border rounded-lg text-sm"
                                        >
                                            {opt.colorHex && (
                                                <span
                                                    className="w-4 h-4 rounded-full border"
                                                    style={{ backgroundColor: opt.colorHex }}
                                                />
                                            )}
                                            {opt.label.uk}
                                            <span className="text-gray-400 text-xs">({opt.value})</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'groups' && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900">Групи атрибутів</h2>
                        <button className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-teal-600 rounded-lg text-sm font-medium hover:bg-teal-100">
                            <PlusIcon className="w-4 h-4" />
                            Додати групу
                        </button>
                    </div>
                    <div className="divide-y">
                        {attributeGroups.map((group) => (
                            <div key={group.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                                        <Squares2X2Icon className="w-5 h-5 text-teal-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-900">{group.name.uk}</p>
                                        <p className="text-sm text-gray-500 font-mono">{group.code}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-gray-500">{group.attributeCount} атрибутів</span>
                                    <div className="flex items-center gap-2">
                                        <button className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg">
                                            <LinkIcon className="w-5 h-5" />
                                        </button>
                                        <button className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg">
                                            <PencilSquareIcon className="w-5 h-5" />
                                        </button>
                                        <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 py-8">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {editAttribute ? 'Редагувати атрибут' : 'Додати атрибут'}
                                </h3>
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                                >
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <form className="space-y-6">
                                {/* Basic info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Код атрибута *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.code}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono"
                                            placeholder="screen_size"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Тип *
                                        </label>
                                        <select
                                            value={formData.type}
                                            onChange={(e) => setFormData({ ...formData, type: e.target.value as AttributeType })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        >
                                            {Object.entries(typeLabels).map(([type, { label }]) => (
                                                <option key={type} value={type}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Назва (UA) *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.nameUk}
                                            onChange={(e) => setFormData({ ...formData, nameUk: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="Діагональ екрану"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Назва (EN)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.nameEn}
                                            onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="Screen Diagonal"
                                        />
                                    </div>
                                </div>

                                {(formData.type === 'number' || formData.type === 'range') && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Одиниця виміру
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.unit}
                                            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            placeholder="дюйм, кг, ГБ..."
                                        />
                                    </div>
                                )}

                                {/* Checkboxes */}
                                <div className="grid grid-cols-2 gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.isFilterable}
                                            onChange={(e) => setFormData({ ...formData, isFilterable: e.target.checked })}
                                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                        />
                                        <span className="text-sm text-gray-700">Показувати у фільтрах</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.isSearchable}
                                            onChange={(e) => setFormData({ ...formData, isSearchable: e.target.checked })}
                                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                        />
                                        <span className="text-sm text-gray-700">Включити в пошук</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.isComparable}
                                            onChange={(e) => setFormData({ ...formData, isComparable: e.target.checked })}
                                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                        />
                                        <span className="text-sm text-gray-700">Показувати в порівнянні</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.isVisible}
                                            onChange={(e) => setFormData({ ...formData, isVisible: e.target.checked })}
                                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                        />
                                        <span className="text-sm text-gray-700">Видимий на сторінці товару</span>
                                    </label>
                                </div>

                                {/* Options for select types */}
                                {(formData.type === 'select' || formData.type === 'multiselect' || formData.type === 'color') && (
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <label className="block text-sm font-medium text-gray-700">
                                                Опції
                                            </label>
                                            <button
                                                type="button"
                                                onClick={addOption}
                                                className="text-sm text-teal-600 hover:text-teal-700 font-medium"
                                            >
                                                + Додати опцію
                                            </button>
                                        </div>
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {formData.options.map((opt, index) => (
                                                <div key={index} className="flex gap-2 items-center">
                                                    <input
                                                        type="text"
                                                        value={opt.value}
                                                        onChange={(e) => updateOption(index, 'value', e.target.value)}
                                                        placeholder="Значення"
                                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={opt.labelUk}
                                                        onChange={(e) => updateOption(index, 'labelUk', e.target.value)}
                                                        placeholder="Назва UA"
                                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                    />
                                                    {formData.type === 'color' && (
                                                        <input
                                                            type="color"
                                                            value={opt.colorHex || '#000000'}
                                                            onChange={(e) => updateOption(index, 'colorHex', e.target.value)}
                                                            className="w-10 h-10 rounded border cursor-pointer"
                                                        />
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeOption(index)}
                                                        className="p-2 text-gray-400 hover:text-red-600"
                                                    >
                                                        <XMarkIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                            {formData.options.length === 0 && (
                                                <p className="text-sm text-gray-400 text-center py-4">
                                                    Немає опцій. Додайте хоча б одну.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3 pt-4 border-t">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700"
                                    >
                                        {editAttribute ? 'Зберегти' : 'Створити'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
