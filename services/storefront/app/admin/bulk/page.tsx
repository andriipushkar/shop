'use client';

import { useState, useCallback } from 'react';
import {
    ArrowUpTrayIcon,
    ArrowDownTrayIcon,
    DocumentArrowDownIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface ImportJob {
    id: string;
    filename: string;
    entity: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    totalRows: number;
    processedRows: number;
    errors: number;
    createdAt: string;
}

const mockJobs: ImportJob[] = [
    {
        id: '1',
        filename: 'products_update.xlsx',
        entity: 'products',
        status: 'completed',
        progress: 100,
        totalRows: 150,
        processedRows: 150,
        errors: 2,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
        id: '2',
        filename: 'prices_december.csv',
        entity: 'prices',
        status: 'processing',
        progress: 65,
        totalRows: 500,
        processedRows: 325,
        errors: 0,
        createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
    {
        id: '3',
        filename: 'inventory_sync.xlsx',
        entity: 'inventory',
        status: 'failed',
        progress: 23,
        totalRows: 200,
        processedRows: 46,
        errors: 15,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
];

const entityOptions = [
    { value: 'products', label: 'Товари' },
    { value: 'categories', label: 'Категорії' },
    { value: 'prices', label: 'Ціни' },
    { value: 'inventory', label: 'Залишки' },
    { value: 'orders', label: 'Замовлення' },
    { value: 'customers', label: 'Клієнти' },
];

export default function BulkOperationsPage() {
    const [activeTab, setActiveTab] = useState<'import' | 'export' | 'history'>('import');
    const [jobs, setJobs] = useState<ImportJob[]>(mockJobs);
    const [selectedEntity, setSelectedEntity] = useState('products');
    const [dragActive, setDragActive] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);

    const formatDate = (dateString: string) => {
        return new Intl.DateTimeFormat('uk-UA', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(new Date(dateString));
    };

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
            setUploadedFile(e.dataTransfer.files[0]);
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploadedFile(e.target.files[0]);
        }
    };

    const handleImport = () => {
        if (!uploadedFile) return;

        const newJob: ImportJob = {
            id: Date.now().toString(),
            filename: uploadedFile.name,
            entity: selectedEntity,
            status: 'pending',
            progress: 0,
            totalRows: 0,
            processedRows: 0,
            errors: 0,
            createdAt: new Date().toISOString(),
        };

        setJobs((prev) => [newJob, ...prev]);
        setUploadedFile(null);
        setActiveTab('history');

        // Simulate processing
        setTimeout(() => {
            setJobs((prev) =>
                prev.map((job) =>
                    job.id === newJob.id
                        ? { ...job, status: 'processing', totalRows: 100, progress: 0 }
                        : job
                )
            );
        }, 1000);
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
            case 'failed':
                return <XCircleIcon className="w-5 h-5 text-red-500" />;
            case 'processing':
                return <ClockIcon className="w-5 h-5 text-blue-500 animate-pulse" />;
            default:
                return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
        }
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            pending: 'Очікує',
            processing: 'Обробка',
            completed: 'Завершено',
            failed: 'Помилка',
        };
        return labels[status] || status;
    };

    const getEntityLabel = (entity: string) => {
        const option = entityOptions.find((opt) => opt.value === entity);
        return option?.label || entity;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Масові операції</h1>
                <p className="text-gray-600">Імпорт, експорт та масове оновлення даних</p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {[
                        { id: 'import', label: 'Імпорт', icon: ArrowUpTrayIcon },
                        { id: 'export', label: 'Експорт', icon: ArrowDownTrayIcon },
                        { id: 'history', label: 'Історія', icon: ClockIcon },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm ${
                                activeTab === tab.id
                                    ? 'border-teal-500 text-teal-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            <tab.icon className="w-5 h-5" />
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Import Tab */}
            {activeTab === 'import' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Імпорт даних</h2>

                        {/* Entity Selection */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Тип даних для імпорту
                            </label>
                            <select
                                value={selectedEntity}
                                onChange={(e) => setSelectedEntity(e.target.value)}
                                className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            >
                                {entityOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* File Upload */}
                        <div
                            data-testid="import-dropzone"
                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                                dragActive
                                    ? 'border-teal-500 bg-teal-50'
                                    : 'border-gray-300 hover:border-gray-400'
                            }`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            {uploadedFile ? (
                                <div className="space-y-4">
                                    <div className="w-16 h-16 bg-teal-100 rounded-xl flex items-center justify-center mx-auto">
                                        <DocumentArrowDownIcon className="w-8 h-8 text-teal-600" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-medium text-gray-900">{uploadedFile.name}</p>
                                        <p className="text-sm text-gray-500">
                                            {(uploadedFile.size / 1024).toFixed(1)} KB
                                        </p>
                                    </div>
                                    <div className="flex justify-center gap-3">
                                        <button
                                            onClick={() => setUploadedFile(null)}
                                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                        >
                                            Скасувати
                                        </button>
                                        <button
                                            onClick={handleImport}
                                            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                                        >
                                            Почати імпорт
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto">
                                        <ArrowUpTrayIcon className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-medium text-gray-900">
                                            Перетягніть файл сюди
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            або натисніть для вибору файлу
                                        </p>
                                    </div>
                                    <input
                                        type="file"
                                        accept=".csv,.xlsx,.xls"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="file-upload"
                                    />
                                    <label
                                        htmlFor="file-upload"
                                        className="inline-block px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 cursor-pointer"
                                    >
                                        Вибрати файл
                                    </label>
                                    <p className="text-xs text-gray-400">
                                        Підтримуються формати: CSV, XLSX, XLS
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Template Download */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Шаблони для імпорту</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {entityOptions.map((entity) => (
                                <button
                                    key={entity.value}
                                    className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition-colors text-left"
                                >
                                    <DocumentArrowDownIcon className="w-8 h-8 text-teal-600" />
                                    <div>
                                        <p className="font-medium text-gray-900">{entity.label}</p>
                                        <p className="text-sm text-gray-500">Завантажити шаблон</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Export Tab */}
            {activeTab === 'export' && (
                <div className="bg-white rounded-xl shadow-sm p-6" data-testid="export-form">
                    <h2 className="text-lg font-semibold text-gray-900 mb-6">Експорт даних</h2>

                    <div className="space-y-6">
                        {/* Entity Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Тип даних для експорту
                            </label>
                            <select
                                data-testid="entity-select"
                                className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            >
                                {entityOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Format Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Формат файлу
                            </label>
                            <div className="flex gap-4">
                                {['CSV', 'XLSX', 'JSON'].map((format) => (
                                    <label key={format} className="flex items-center">
                                        <input
                                            type="radio"
                                            name="format"
                                            value={format.toLowerCase()}
                                            defaultChecked={format === 'CSV'}
                                            className="w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                                        />
                                        <span className="ml-2 text-sm text-gray-700">{format}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {/* Date Range */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Період (опціонально)
                            </label>
                            <div className="flex gap-4">
                                <input
                                    type="date"
                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                />
                                <span className="py-2 text-gray-500">—</span>
                                <input
                                    type="date"
                                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Export Button */}
                        <div>
                            <button className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                                <ArrowDownTrayIcon className="w-5 h-5" />
                                Експортувати
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Файл
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Тип
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Статус
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Прогрес
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                        Дата
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                        Дії
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {jobs.map((job) => (
                                    <tr key={job.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <DocumentArrowDownIcon className="w-8 h-8 text-gray-400" />
                                                <span className="text-sm font-medium text-gray-900">
                                                    {job.filename}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-600">
                                                {getEntityLabel(job.entity)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(job.status)}
                                                <span className="text-sm text-gray-900">
                                                    {getStatusLabel(job.status)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="w-32">
                                                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                                    <span>{job.processedRows} / {job.totalRows}</span>
                                                    <span>{job.progress}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className={`h-2 rounded-full ${
                                                            job.status === 'failed'
                                                                ? 'bg-red-500'
                                                                : job.status === 'completed'
                                                                ? 'bg-green-500'
                                                                : 'bg-teal-500'
                                                        }`}
                                                        style={{ width: `${job.progress}%` }}
                                                    />
                                                </div>
                                                {job.errors > 0 && (
                                                    <p className="text-xs text-red-500 mt-1">
                                                        {job.errors} помилок
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-500">
                                                {formatDate(job.createdAt)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button className="text-teal-600 hover:text-teal-900 text-sm font-medium">
                                                Деталі
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
