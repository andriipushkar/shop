'use client';

import React, { useState } from 'react';
import { CalendarIcon } from '@heroicons/react/24/outline';

export interface DateRange {
  startDate: string;
  endDate: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const PRESET_RANGES = [
  { label: 'Сьогодні', days: 0 },
  { label: 'Вчора', days: 1 },
  { label: 'Останні 7 днів', days: 7 },
  { label: 'Останні 30 днів', days: 30 },
  { label: 'Останні 90 днів', days: 90 },
  { label: 'Цей місяць', days: 'month' as const },
  { label: 'Минулий місяць', days: 'last-month' as const },
];

export default function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePresetClick = (preset: typeof PRESET_RANGES[0]) => {
    const endDate = new Date();
    let startDate = new Date();

    if (preset.days === 0) {
      // Сьогодні
      startDate = new Date();
    } else if (preset.days === 1) {
      // Вчора
      startDate.setDate(endDate.getDate() - 1);
      endDate.setDate(endDate.getDate() - 1);
    } else if (preset.days === 'month') {
      // Цей місяць
      startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    } else if (preset.days === 'last-month') {
      // Минулий місяць
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - 1, 1);
      endDate = new Date(endDate.getFullYear(), endDate.getMonth(), 0);
    } else {
      // Кількість днів
      startDate.setDate(endDate.getDate() - preset.days);
    }

    onChange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    });
    setIsOpen(false);
  };

  const handleCustomChange = (field: 'startDate' | 'endDate', value: string) => {
    onChange({
      ...value,
      [field]: value,
    });
  };

  const formatDateRange = () => {
    const start = new Date(value.startDate);
    const end = new Date(value.endDate);

    return `${start.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <CalendarIcon className="w-5 h-5 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">
          {formatDateRange()}
        </span>
      </button>

      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-20">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Оберіть період
              </h3>

              {/* Швидкий вибір */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {PRESET_RANGES.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => handlePresetClick(preset)}
                    className="px-3 py-2 text-sm text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Кастомний вибір */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-xs font-medium text-gray-700 mb-2">
                  Або оберіть власний період:
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Початкова дата
                    </label>
                    <input
                      type="date"
                      value={value.startDate}
                      onChange={(e) => handleCustomChange('startDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Кінцева дата
                    </label>
                    <input
                      type="date"
                      value={value.endDate}
                      onChange={(e) => handleCustomChange('endDate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Кнопка застосування */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Застосувати
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
