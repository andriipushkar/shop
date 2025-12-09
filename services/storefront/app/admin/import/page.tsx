'use client';

import { useState, useCallback } from 'react';
import {
    CloudArrowUpIcon,
    DocumentArrowDownIcon,
    DocumentTextIcon,
    TableCellsIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    XCircleIcon,
    ArrowPathIcon,
    InformationCircleIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';

type ImportType = 'products' | 'prices' | 'discounts' | 'stock';
type ImportStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error';

interface ImportHistory {
    id: number;
    type: ImportType;
    filename: string;
    date: string;
    status: 'success' | 'partial' | 'error';
    totalRows: number;
    successRows: number;
    errorRows: number;
}

const importTypes = [
    {
        id: 'products' as ImportType,
        name: 'Товари',
        description: 'Імпорт нових товарів або оновлення існуючих',
        icon: TableCellsIcon,
        template: 'products_template.xlsx',
        fields: ['SKU', 'Назва', 'Опис', 'Ціна', 'Категорія', 'Залишок', 'Зображення URL'],
    },
    {
        id: 'prices' as ImportType,
        name: 'Прайс-лист',
        description: 'Масове оновлення цін на товари',
        icon: DocumentTextIcon,
        template: 'prices_template.xlsx',
        fields: ['SKU', 'Нова ціна', 'Стара ціна (опціонально)'],
    },
    {
        id: 'discounts' as ImportType,
        name: 'Знижки',
        description: 'Масове встановлення знижок на товари',
        icon: DocumentArrowDownIcon,
        template: 'discounts_template.xlsx',
        fields: ['SKU', 'Знижка (%)', 'Дата початку', 'Дата закінчення'],
    },
    {
        id: 'stock' as ImportType,
        name: 'Залишки',
        description: 'Оновлення залишків на складі',
        icon: TableCellsIcon,
        template: 'stock_template.xlsx',
        fields: ['SKU', 'Кількість', 'Склад (опціонально)'],
    },
];

const importHistory: ImportHistory[] = [
    { id: 1, type: 'prices', filename: 'prices_december.xlsx', date: '10.12.2024 14:30', status: 'success', totalRows: 156, successRows: 156, errorRows: 0 },
    { id: 2, type: 'products', filename: 'new_products.csv', date: '09.12.2024 11:15', status: 'partial', totalRows: 45, successRows: 42, errorRows: 3 },
    { id: 3, type: 'discounts', filename: 'winter_sale.xlsx', date: '08.12.2024 16:45', status: 'success', totalRows: 234, successRows: 234, errorRows: 0 },
    { id: 4, type: 'stock', filename: 'warehouse_update.xlsx', date: '07.12.2024 09:00', status: 'error', totalRows: 89, successRows: 0, errorRows: 89 },
];

export default function AdminImportPage() {
    const [selectedType, setSelectedType] = useState<ImportType>('products');
    const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
    const [dragActive, setDragActive] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [progress, setProgress] = useState(0);
    const [importResult, setImportResult] = useState<{ success: number; errors: number; total: number } | null>(null);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, []);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleFile = (file: File) => {
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        if (!validExtensions.includes(extension)) {
            alert('Підтримуються тільки файли Excel (.xlsx, .xls) та CSV (.csv)');
            return;
        }

        setUploadedFile(file);
        setImportStatus('idle');
        setImportResult(null);
    };

    const startImport = async () => {
        if (!uploadedFile) return;

        setImportStatus('uploading');
        setProgress(0);

        // Simulate upload progress
        for (let i = 0; i <= 30; i++) {
            await new Promise(resolve => setTimeout(resolve, 50));
            setProgress(i);
        }

        setImportStatus('processing');

        // Simulate processing
        for (let i = 30; i <= 100; i++) {
            await new Promise(resolve => setTimeout(resolve, 30));
            setProgress(i);
        }

        // Simulate result
        const total = Math.floor(Math.random() * 100) + 50;
        const errors = Math.floor(Math.random() * 5);
        setImportResult({
            total,
            success: total - errors,
            errors,
        });

        setImportStatus(errors > 0 ? 'error' : 'success');
    };

    const resetImport = () => {
        setUploadedFile(null);
        setImportStatus('idle');
        setProgress(0);
        setImportResult(null);
    };

    const downloadTemplate = (template: string) => {
        // In real app, this would download the actual template
        alert(`Завантаження шаблону: ${template}`);
    };

    const getStatusBadge = (status: ImportHistory['status']) => {
        switch (status) {
            case 'success':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                        Успішно
                    </span>
                );
            case 'partial':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                        Частково
                    </span>
                );
            case 'error':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <XCircleIcon className="w-3.5 h-3.5" />
                        Помилка
                    </span>
                );
        }
    };

    const selectedTypeInfo = importTypes.find(t => t.id === selectedType)!;

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Імпорт даних</h1>
                <p className="text-gray-600">Завантаження прайс-листів, товарів та знижок</p>
            </div>

            {/* Import type selector */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {importTypes.map((type) => (
                    <button
                        key={type.id}
                        onClick={() => {
                            setSelectedType(type.id);
                            resetImport();
                        }}
                        className={`p-4 rounded-xl text-left transition-all ${
                            selectedType === type.id
                                ? 'bg-teal-50 border-2 border-teal-500 shadow-sm'
                                : 'bg-white border-2 border-transparent shadow-sm hover:border-gray-200'
                        }`}
                    >
                        <type.icon className={`w-8 h-8 mb-2 ${
                            selectedType === type.id ? 'text-teal-600' : 'text-gray-400'
                        }`} />
                        <h3 className={`font-semibold ${
                            selectedType === type.id ? 'text-teal-900' : 'text-gray-900'
                        }`}>
                            {type.name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                    </button>
                ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Upload area */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">
                            Завантажити файл
                        </h2>

                        {/* Drag & Drop area */}
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                                dragActive
                                    ? 'border-teal-500 bg-teal-50'
                                    : uploadedFile
                                        ? 'border-green-500 bg-green-50'
                                        : 'border-gray-300 hover:border-gray-400'
                            }`}
                        >
                            {!uploadedFile ? (
                                <>
                                    <CloudArrowUpIcon className={`w-12 h-12 mx-auto mb-4 ${
                                        dragActive ? 'text-teal-500' : 'text-gray-400'
                                    }`} />
                                    <p className="text-gray-600 mb-2">
                                        Перетягніть файл сюди або
                                    </p>
                                    <label className="inline-block">
                                        <span className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium cursor-pointer hover:bg-teal-700 transition-colors">
                                            Виберіть файл
                                        </span>
                                        <input
                                            type="file"
                                            accept=".xlsx,.xls,.csv"
                                            onChange={handleFileInput}
                                            className="hidden"
                                        />
                                    </label>
                                    <p className="text-sm text-gray-500 mt-4">
                                        Підтримуються формати: Excel (.xlsx, .xls), CSV (.csv)
                                    </p>
                                </>
                            ) : (
                                <>
                                    <DocumentTextIcon className="w-12 h-12 mx-auto mb-4 text-green-500" />
                                    <p className="font-medium text-gray-900">{uploadedFile.name}</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {(uploadedFile.size / 1024).toFixed(1)} KB
                                    </p>
                                    <button
                                        onClick={resetImport}
                                        className="mt-4 text-sm text-red-600 hover:text-red-700 font-medium"
                                    >
                                        Видалити файл
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Progress bar */}
                        {(importStatus === 'uploading' || importStatus === 'processing') && (
                            <div className="mt-6">
                                <div className="flex items-center justify-between text-sm mb-2">
                                    <span className="text-gray-600">
                                        {importStatus === 'uploading' ? 'Завантаження...' : 'Обробка даних...'}
                                    </span>
                                    <span className="font-medium text-gray-900">{progress}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-teal-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Import result */}
                        {importResult && (
                            <div className={`mt-6 p-4 rounded-lg ${
                                importStatus === 'success' ? 'bg-green-50' : 'bg-yellow-50'
                            }`}>
                                <div className="flex items-start gap-3">
                                    {importStatus === 'success' ? (
                                        <CheckCircleIcon className="w-6 h-6 text-green-600 flex-shrink-0" />
                                    ) : (
                                        <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                                    )}
                                    <div>
                                        <h3 className={`font-semibold ${
                                            importStatus === 'success' ? 'text-green-900' : 'text-yellow-900'
                                        }`}>
                                            {importStatus === 'success' ? 'Імпорт завершено успішно!' : 'Імпорт завершено з помилками'}
                                        </h3>
                                        <div className="mt-2 text-sm space-y-1">
                                            <p className="text-gray-600">Всього рядків: <span className="font-medium">{importResult.total}</span></p>
                                            <p className="text-green-600">Успішно: <span className="font-medium">{importResult.success}</span></p>
                                            {importResult.errors > 0 && (
                                                <p className="text-red-600">Помилок: <span className="font-medium">{importResult.errors}</span></p>
                                            )}
                                        </div>
                                        {importResult.errors > 0 && (
                                            <button className="mt-3 text-sm text-teal-600 hover:text-teal-700 font-medium">
                                                Завантажити звіт про помилки
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Action buttons */}
                        <div className="mt-6 flex gap-3">
                            {uploadedFile && importStatus === 'idle' && (
                                <button
                                    onClick={startImport}
                                    className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                >
                                    Почати імпорт
                                </button>
                            )}
                            {importResult && (
                                <button
                                    onClick={resetImport}
                                    className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                                >
                                    <ArrowPathIcon className="w-5 h-5 inline mr-2" />
                                    Новий імпорт
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Import history */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b">
                            <h2 className="text-lg font-semibold text-gray-900">Історія імпорту</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Файл</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Результат</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {importHistory.map((item) => (
                                        <tr key={item.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <DocumentTextIcon className="w-5 h-5 text-gray-400" />
                                                    <span className="text-sm font-medium text-gray-900">{item.filename}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {importTypes.find(t => t.id === item.type)?.name}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{item.date}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {item.successRows}/{item.totalRows} рядків
                                            </td>
                                            <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Template download */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Шаблон файлу</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Завантажте шаблон для правильного формату даних
                        </p>
                        <button
                            onClick={() => downloadTemplate(selectedTypeInfo.template)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-teal-600 text-teal-600 rounded-lg font-medium hover:bg-teal-50 transition-colors"
                        >
                            <DocumentArrowDownIcon className="w-5 h-5" />
                            Завантажити шаблон
                        </button>
                    </div>

                    {/* Required fields */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Обов&apos;язкові поля</h3>
                        <ul className="space-y-2">
                            {selectedTypeInfo.fields.map((field, index) => (
                                <li key={index} className="flex items-center gap-2 text-sm">
                                    <CheckCircleIcon className="w-4 h-4 text-teal-500 flex-shrink-0" />
                                    <span className="text-gray-600">{field}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Tips */}
                    <div className="bg-blue-50 rounded-xl p-6">
                        <div className="flex items-start gap-3">
                            <InformationCircleIcon className="w-6 h-6 text-blue-600 flex-shrink-0" />
                            <div>
                                <h3 className="font-semibold text-blue-900 mb-2">Поради</h3>
                                <ul className="text-sm text-blue-800 space-y-2">
                                    <li>• SKU має бути унікальним для кожного товару</li>
                                    <li>• Ціни вказуйте в гривнях без валюти</li>
                                    <li>• Дати у форматі ДД.ММ.РРРР</li>
                                    <li>• Максимальний розмір файлу: 10 MB</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
