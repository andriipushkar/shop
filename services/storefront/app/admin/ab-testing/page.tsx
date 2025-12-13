'use client';

/**
 * A/B Testing Admin Dashboard
 * Create, manage, and analyze experiments
 */

import React, { useState, useEffect } from 'react';
import {
  Experiment,
  ExperimentStatus,
  Variant,
  ExperimentResults,
  VariantResult,
} from '@/lib/ab-testing';

// ==================== TYPES ====================

interface NewExperiment {
  name: string;
  description: string;
  type: string;
  allocation: number;
  variants: {
    id: string;
    name: string;
    weight: number;
    isControl: boolean;
    config: Record<string, unknown>;
  }[];
}

// ==================== MAIN COMPONENT ====================

export default function ABTestingAdminPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [results, setResults] = useState<ExperimentResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Load experiments
  useEffect(() => {
    loadExperiments();
  }, []);

  // Load results when experiment is selected
  useEffect(() => {
    if (selectedExperiment) {
      loadResults(selectedExperiment.id);
    }
  }, [selectedExperiment]);

  const loadExperiments = async () => {
    try {
      const response = await fetch('/api/ab/experiments');
      if (response.ok) {
        const data = await response.json();
        setExperiments(data);
      }
    } catch (error) {
      console.error('Failed to load experiments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadResults = async (experimentId: string) => {
    try {
      const response = await fetch(`/api/ab/results/${experimentId}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data);
      }
    } catch (error) {
      console.error('Failed to load results:', error);
    }
  };

  const handleCreateExperiment = async (experiment: NewExperiment) => {
    try {
      const response = await fetch('/api/ab/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(experiment),
      });

      if (response.ok) {
        await loadExperiments();
        setShowCreateForm(false);
      }
    } catch (error) {
      console.error('Failed to create experiment:', error);
    }
  };

  const handleUpdateStatus = async (experimentId: string, status: ExperimentStatus) => {
    try {
      const response = await fetch(`/api/ab/experiments/${experimentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        await loadExperiments();
      }
    } catch (error) {
      console.error('Failed to update experiment:', error);
    }
  };

  const handleDeclareWinner = async (experimentId: string, winnerId: string) => {
    try {
      const response = await fetch(`/api/ab/experiments/${experimentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          winner: winnerId,
          endDate: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        await loadExperiments();
      }
    } catch (error) {
      console.error('Failed to declare winner:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Завантаження...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">A/B Тестування</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Створити експеримент
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Experiments List */}
        <div className="lg:col-span-1">
          <ExperimentsList
            experiments={experiments}
            selectedId={selectedExperiment?.id}
            onSelect={setSelectedExperiment}
          />
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
          {selectedExperiment ? (
            <ResultsPanel
              experiment={selectedExperiment}
              results={results}
              onUpdateStatus={handleUpdateStatus}
              onDeclareWinner={handleDeclareWinner}
            />
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              Оберіть експеримент для перегляду результатів
            </div>
          )}
        </div>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <CreateExperimentModal
          onClose={() => setShowCreateForm(false)}
          onCreate={handleCreateExperiment}
        />
      )}
    </div>
  );
}

// ==================== EXPERIMENTS LIST ====================

function ExperimentsList({
  experiments,
  selectedId,
  onSelect,
}: {
  experiments: Experiment[];
  selectedId?: string;
  onSelect: (exp: Experiment) => void;
}) {
  const getStatusColor = (status: ExperimentStatus) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: ExperimentStatus) => {
    switch (status) {
      case 'running':
        return 'Активний';
      case 'completed':
        return 'Завершено';
      case 'paused':
        return 'Призупинено';
      case 'draft':
        return 'Чернетка';
      default:
        return status;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="font-semibold">Експерименти ({experiments.length})</h2>
      </div>
      <div className="divide-y max-h-[600px] overflow-y-auto">
        {experiments.map(exp => (
          <button
            key={exp.id}
            onClick={() => onSelect(exp)}
            className={`w-full text-left p-4 hover:bg-gray-50 transition ${
              selectedId === exp.id ? 'bg-blue-50' : ''
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-medium">{exp.name}</h3>
              <span
                className={`px-2 py-1 text-xs rounded-full ${getStatusColor(exp.status)}`}
              >
                {getStatusLabel(exp.status)}
              </span>
            </div>
            <p className="text-sm text-gray-600 line-clamp-2">{exp.description}</p>
            <div className="flex gap-2 mt-2 text-xs text-gray-500">
              <span>{exp.variants.length} варіантів</span>
              <span>•</span>
              <span>{exp.allocation}% трафіку</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ==================== RESULTS PANEL ====================

function ResultsPanel({
  experiment,
  results,
  onUpdateStatus,
  onDeclareWinner,
}: {
  experiment: Experiment;
  results: ExperimentResults | null;
  onUpdateStatus: (id: string, status: ExperimentStatus) => void;
  onDeclareWinner: (id: string, winnerId: string) => void;
}) {
  if (!results) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        Завантаження результатів...
      </div>
    );
  }

  const controlResult = results.variantResults.find(r => {
    const variant = experiment.variants.find(v => v.id === r.variantId);
    return variant?.isControl;
  });

  return (
    <div className="space-y-6">
      {/* Experiment Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">{experiment.name}</h2>
            <p className="text-gray-600">{experiment.description}</p>
          </div>
          <div className="flex gap-2">
            {experiment.status === 'running' && (
              <button
                onClick={() => onUpdateStatus(experiment.id, 'paused')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Призупинити
              </button>
            )}
            {experiment.status === 'paused' && (
              <button
                onClick={() => onUpdateStatus(experiment.id, 'running')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Запустити
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Учасників</div>
            <div className="text-2xl font-bold">{results.totalParticipants}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Статистична значущість</div>
            <div className="text-2xl font-bold">
              {results.statisticalSignificance}%
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Покращення</div>
            <div
              className={`text-2xl font-bold ${
                (results.uplift || 0) > 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {results.uplift ? `${results.uplift > 0 ? '+' : ''}${results.uplift}%` : 'N/A'}
            </div>
          </div>
        </div>

        {/* Statistical Significance Indicator */}
        {results.statisticalSignificance >= 95 && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span className="font-medium text-green-900">
                Результати статистично значущі (95%+ довіра)
              </span>
            </div>
            {results.recommendedVariant && (
              <div className="mt-2 text-sm text-green-700">
                Рекомендований варіант: {results.recommendedVariant}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Variants Results */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-bold mb-4">Результати варіантів</h3>
        <div className="space-y-4">
          {results.variantResults.map(result => {
            const variant = experiment.variants.find(v => v.id === result.variantId);
            if (!variant) return null;

            const isWinner = experiment.winner === variant.id;
            const isRecommended = results.recommendedVariant === variant.id;

            return (
              <div
                key={variant.id}
                className={`border rounded-lg p-4 ${
                  isWinner ? 'border-green-500 bg-green-50' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold">
                      {variant.name}
                      {variant.isControl && (
                        <span className="ml-2 text-xs bg-gray-200 px-2 py-1 rounded">
                          Контроль
                        </span>
                      )}
                      {isWinner && (
                        <span className="ml-2 text-xs bg-green-600 text-white px-2 py-1 rounded">
                          Переможець
                        </span>
                      )}
                      {isRecommended && !isWinner && (
                        <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">
                          Рекомендовано
                        </span>
                      )}
                    </h4>
                    <p className="text-sm text-gray-600">{variant.description}</p>
                  </div>
                  {!isWinner && results.statisticalSignificance >= 95 && isRecommended && (
                    <button
                      onClick={() => onDeclareWinner(experiment.id, variant.id)}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                    >
                      Оголосити переможцем
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-gray-600">Учасники</div>
                    <div className="text-lg font-semibold">{result.participants}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Конверсії</div>
                    <div className="text-lg font-semibold">{result.conversions}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Коефіцієнт конверсії</div>
                    <div className="text-lg font-semibold">
                      {result.conversionRate.toFixed(2)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600">Дохід</div>
                    <div className="text-lg font-semibold">
                      {result.revenue?.toFixed(2) || 0} грн
                    </div>
                  </div>
                </div>

                {/* Conversion rate bar */}
                <div className="mt-3">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        variant.isControl ? 'bg-gray-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(result.conversionRate, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Uplift vs control */}
                {!variant.isControl && controlResult && (
                  <div className="mt-2 text-sm">
                    Порівняно з контролем:{' '}
                    <span
                      className={
                        result.conversionRate > controlResult.conversionRate
                          ? 'text-green-600 font-semibold'
                          : 'text-red-600 font-semibold'
                      }
                    >
                      {result.conversionRate > controlResult.conversionRate ? '+' : ''}
                      {(
                        ((result.conversionRate - controlResult.conversionRate) /
                          controlResult.conversionRate) *
                        100
                      ).toFixed(2)}
                      %
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ==================== CREATE EXPERIMENT MODAL ====================

function CreateExperimentModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (exp: NewExperiment) => void;
}) {
  const [formData, setFormData] = useState<NewExperiment>({
    name: '',
    description: '',
    type: 'ab_test',
    allocation: 100,
    variants: [
      { id: 'control', name: 'Контроль', weight: 50, isControl: true, config: {} },
      { id: 'variant_a', name: 'Варіант A', weight: 50, isControl: false, config: {} },
    ],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
  };

  const updateVariantWeight = (index: number, weight: number) => {
    const newVariants = [...formData.variants];
    newVariants[index].weight = weight;
    setFormData({ ...formData, variants: newVariants });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">Створити експеримент</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Назва</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Опис</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full border rounded-lg px-3 py-2"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Розподіл трафіку (%)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={formData.allocation}
                onChange={e =>
                  setFormData({ ...formData, allocation: parseInt(e.target.value) })
                }
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Варіанти</label>
              {formData.variants.map((variant, index) => (
                <div key={variant.id} className="border rounded-lg p-3 mb-2">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={variant.name}
                      onChange={e => {
                        const newVariants = [...formData.variants];
                        newVariants[index].name = e.target.value;
                        setFormData({ ...formData, variants: newVariants });
                      }}
                      className="flex-1 border rounded px-2 py-1"
                      placeholder="Назва варіанту"
                    />
                    <input
                      type="number"
                      value={variant.weight}
                      onChange={e => updateVariantWeight(index, parseInt(e.target.value))}
                      className="w-20 border rounded px-2 py-1"
                      placeholder="Вага"
                    />
                    <span className="text-sm text-gray-500 self-center">%</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Скасувати
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Створити
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
