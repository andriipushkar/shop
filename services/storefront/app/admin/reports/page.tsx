'use client';

import { useState } from 'react';
import {
    DocumentArrowDownIcon,
    CalendarIcon,
    TableCellsIcon,
    ChartBarIcon,
    CurrencyDollarIcon,
    ShoppingCartIcon,
    UsersIcon,
    ShoppingBagIcon,
    ClockIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';

type ReportType = 'sales' | 'products' | 'customers' | 'orders' | 'inventory';
type ExportFormat = 'xlsx' | 'csv' | 'pdf';
type DateRange = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

interface ScheduledReport {
    id: number;
    name: string;
    type: ReportType;
    schedule: string;
    lastRun: string;
    nextRun: string;
    email: string;
}

const reportTypes = [
    {
        id: 'sales' as ReportType,
        name: 'Звіт по продажах',
        description: 'Доходи, замовлення, середній чек',
        icon: CurrencyDollarIcon,
        fields: ['Дата', 'Кількість замовлень', 'Дохід', 'Середній чек', 'Знижки'],
    },
    {
        id: 'products' as ReportType,
        name: 'Звіт по товарах',
        description: 'Топ товари, продажі по категоріях',
        icon: ShoppingBagIcon,
        fields: ['SKU', 'Назва', 'Категорія', 'Продано', 'Дохід', 'Залишок'],
    },
    {
        id: 'customers' as ReportType,
        name: 'Звіт по клієнтах',
        description: 'Нові клієнти, повторні покупки',
        icon: UsersIcon,
        fields: ['Ім\'я', 'Email', 'Дата реєстрації', 'Замовлень', 'Витрачено'],
    },
    {
        id: 'orders' as ReportType,
        name: 'Звіт по замовленнях',
        description: 'Детальний список замовлень',
        icon: ShoppingCartIcon,
        fields: ['№ замовлення', 'Дата', 'Клієнт', 'Статус', 'Сума', 'Оплата'],
    },
    {
        id: 'inventory' as ReportType,
        name: 'Звіт по залишках',
        description: 'Залишки на складі, рух товарів',
        icon: TableCellsIcon,
        fields: ['SKU', 'Назва', 'Поточний залишок', 'Зарезервовано', 'Мін. залишок'],
    },
];

const scheduledReports: ScheduledReport[] = [
    { id: 1, name: 'Щоденний звіт продажів', type: 'sales', schedule: 'Щодня о 09:00', lastRun: '10.12.2024 09:00', nextRun: '11.12.2024 09:00', email: 'admin@myshop.ua' },
    { id: 2, name: 'Тижневий звіт по товарах', type: 'products', schedule: 'Щопонеділка о 08:00', lastRun: '09.12.2024 08:00', nextRun: '16.12.2024 08:00', email: 'manager@myshop.ua' },
    { id: 3, name: 'Місячний звіт по залишках', type: 'inventory', schedule: '1 числа о 07:00', lastRun: '01.12.2024 07:00', nextRun: '01.01.2025 07:00', email: 'warehouse@myshop.ua' },
];

const recentExports = [
    { id: 1, name: 'sales_december_2024.xlsx', type: 'sales', date: '10.12.2024 14:30', size: '245 KB' },
    { id: 2, name: 'products_report.csv', type: 'products', date: '09.12.2024 11:15', size: '1.2 MB' },
    { id: 3, name: 'customers_q4_2024.xlsx', type: 'customers', date: '08.12.2024 16:45', size: '567 KB' },
];

export default function AdminReportsPage() {
    const [selectedType, setSelectedType] = useState<ReportType>('sales');
    const [dateRange, setDateRange] = useState<DateRange>('month');
    const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
    const [isGenerating, setIsGenerating] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);

    const handleExport = async () => {
        setIsGenerating(true);
        // Simulate export
        await new Promise(resolve => setTimeout(resolve, 2000));
        setIsGenerating(false);
        alert(`Звіт ${selectedType}_report.${exportFormat} успішно згенеровано!`);
    };

    const selectedTypeInfo = reportTypes.find(t => t.id === selectedType)!;

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Звіти та експорт</h1>
                    <p className="text-gray-600">Генерація звітів та експорт даних</p>
                </div>
                <button
                    onClick={() => setShowScheduleModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 border border-teal-600 text-teal-600 rounded-lg font-medium hover:bg-teal-50 transition-colors"
                >
                    <ClockIcon className="w-5 h-5" />
                    Запланувати звіт
                </button>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* Report builder */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Report type */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Тип звіту</h2>
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {reportTypes.map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => setSelectedType(type.id)}
                                    className={`p-4 rounded-lg text-left transition-all ${
                                        selectedType === type.id
                                            ? 'bg-teal-50 border-2 border-teal-500'
                                            : 'bg-gray-50 border-2 border-transparent hover:border-gray-200'
                                    }`}
                                >
                                    <type.icon className={`w-6 h-6 mb-2 ${
                                        selectedType === type.id ? 'text-teal-600' : 'text-gray-400'
                                    }`} />
                                    <h3 className={`font-medium ${
                                        selectedType === type.id ? 'text-teal-900' : 'text-gray-900'
                                    }`}>
                                        {type.name}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1">{type.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Date range and format */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Параметри</h2>
                        <div className="grid sm:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Період
                                </label>
                                <select
                                    value={dateRange}
                                    onChange={(e) => setDateRange(e.target.value as DateRange)}
                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                >
                                    <option value="today">Сьогодні</option>
                                    <option value="week">Останній тиждень</option>
                                    <option value="month">Останній місяць</option>
                                    <option value="quarter">Останній квартал</option>
                                    <option value="year">Останній рік</option>
                                    <option value="custom">Власний період</option>
                                </select>
                            </div>

                            {dateRange === 'custom' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Дата від
                                        </label>
                                        <div className="relative">
                                            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <input
                                                type="date"
                                                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Дата до
                                        </label>
                                        <div className="relative">
                                            <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                            <input
                                                type="date"
                                                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Формат експорту
                                </label>
                                <div className="flex gap-2">
                                    {(['xlsx', 'csv', 'pdf'] as ExportFormat[]).map((format) => (
                                        <button
                                            key={format}
                                            onClick={() => setExportFormat(format)}
                                            className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                                                exportFormat === format
                                                    ? 'bg-teal-600 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                        >
                                            {format.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Fields preview */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Поля у звіті</h2>
                        <div className="flex flex-wrap gap-2">
                            {selectedTypeInfo.fields.map((field) => (
                                <label key={field} className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                                    <input
                                        type="checkbox"
                                        defaultChecked
                                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    <span className="text-sm text-gray-700">{field}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Export button */}
                    <button
                        onClick={handleExport}
                        disabled={isGenerating}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Генерація звіту...
                            </>
                        ) : (
                            <>
                                <DocumentArrowDownIcon className="w-5 h-5" />
                                Експортувати звіт
                            </>
                        )}
                    </button>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Scheduled reports */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Заплановані звіти</h3>
                        <div className="space-y-4">
                            {scheduledReports.map((report) => (
                                <div key={report.id} className="p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900 text-sm">{report.name}</p>
                                            <p className="text-xs text-gray-500 mt-1">{report.schedule}</p>
                                        </div>
                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                                            Активний
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Наступний запуск: {report.nextRun}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent exports */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Останні експорти</h3>
                        <div className="space-y-3">
                            {recentExports.map((file) => (
                                <div key={file.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <DocumentArrowDownIcon className="w-5 h-5 text-gray-400" />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                                                {file.name}
                                            </p>
                                            <p className="text-xs text-gray-500">{file.date}</p>
                                        </div>
                                    </div>
                                    <button className="text-teal-600 hover:text-teal-700 text-sm font-medium">
                                        Завантажити
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick stats */}
                    <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-6 text-white">
                        <ChartBarIcon className="w-8 h-8 mb-3 opacity-80" />
                        <h3 className="font-semibold mb-2">Статистика експорту</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="opacity-80">Цього місяця:</span>
                                <span className="font-medium">24 звіти</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="opacity-80">Загальний розмір:</span>
                                <span className="font-medium">156 MB</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Schedule Modal */}
            {showScheduleModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setShowScheduleModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Запланувати звіт</h3>
                            <form className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Назва
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="Мій запланований звіт"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Тип звіту
                                    </label>
                                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                        {reportTypes.map((type) => (
                                            <option key={type.id} value={type.id}>{type.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Періодичність
                                    </label>
                                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                                        <option value="daily">Щодня</option>
                                        <option value="weekly">Щотижня</option>
                                        <option value="monthly">Щомісяця</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email для відправки
                                    </label>
                                    <input
                                        type="email"
                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                        placeholder="email@example.com"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowScheduleModal(false)}
                                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        Скасувати
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                    >
                                        Запланувати
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
