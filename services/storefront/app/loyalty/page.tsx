'use client';

/**
 * Loyalty Program Dashboard Page
 * Full dashboard showing loyalty status, rewards, history, and tier benefits
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth-context';
import { useLoyalty } from '../../lib/loyalty/loyalty-context';
import LoyaltyCard from '../../components/LoyaltyCard';
import LoyaltyRewards from '../../components/LoyaltyRewards';
import { PointsTransaction, LOYALTY_TIERS } from '../../lib/loyalty';
import {
  formatPoints,
  formatCurrency,
  getTierBadgeClasses,
  getTierIcon,
} from '../../lib/loyalty/loyalty-program';

type TabType = 'overview' | 'rewards' | 'history' | 'tiers';

export default function LoyaltyPage() {
  const { user, isAuthenticated } = useAuth();
  const {
    member,
    isLoading,
    isEnrolled,
    enrollInProgram,
    currentTier,
  } = useLoyalty();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);

  // Load transactions from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && member) {
      const stored = localStorage.getItem('loyalty_transactions');
      if (stored) {
        const allTransactions: PointsTransaction[] = JSON.parse(stored);
        const memberTransactions = allTransactions.filter(t => t.memberId === member.id);
        setTransactions(memberTransactions);
      }
    }
  }, [member]);

  const handleEnroll = async () => {
    try {
      await enrollInProgram();
    } catch (error) {
      console.error('Error enrolling:', error);
      alert(error instanceof Error ? error.message : 'Помилка реєстрації');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Увійдіть до свого облікового запису
            </h1>
            <p className="text-gray-600 mb-6">
              Щоб переглянути вашу програму лояльності, будь ласка, увійдіть
            </p>
            <a
              href="/auth/login"
              className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Увійти
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isEnrolled) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl shadow-xl overflow-hidden">
            <div className="p-8 text-white text-center">
              <div className="text-7xl mb-6">🎁</div>
              <h1 className="text-3xl font-bold mb-4">
                Приєднайтесь до програми лояльності!
              </h1>
              <p className="text-lg text-purple-100 mb-8 max-w-2xl mx-auto">
                Отримуйте бали за кожну покупку, обмінюйте їх на знижки та насолоджуйтесь ексклюзивними перевагами
              </p>
              <button
                onClick={handleEnroll}
                className="bg-white text-purple-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-purple-50 transition-colors shadow-lg"
              >
                Приєднатися безкоштовно
              </button>
            </div>

            <div className="bg-white p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                Переваги програми
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-4xl mb-3">💰</div>
                  <h3 className="font-bold text-gray-900 mb-2">
                    Заробляйте бали
                  </h3>
                  <p className="text-gray-600 text-sm">
                    1 бал за кожні 10 грн покупок
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-3">🎯</div>
                  <h3 className="font-bold text-gray-900 mb-2">
                    Використовуйте знижки
                  </h3>
                  <p className="text-gray-600 text-sm">
                    1 бал = 1 грн знижки
                  </p>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-3">👑</div>
                  <h3 className="font-bold text-gray-900 mb-2">
                    Підвищуйте рівень
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Отримуйте більше переваг
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Програма лояльності
          </h1>
          <p className="text-gray-600">
            Керуйте своїми балами та винагородами
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'overview'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Огляд
              </button>
              <button
                onClick={() => setActiveTab('rewards')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'rewards'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Винагороди
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'history'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Історія
              </button>
              <button
                onClick={() => setActiveTab('tiers')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'tiers'
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Рівні
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <>
              <LoyaltyCard variant="full" showHistory={true} />
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Як заробляти більше балів
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="text-2xl">🛍️</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Робіть покупки</h4>
                      <p className="text-sm text-gray-600">
                        Отримуйте бали за кожне замовлення
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="text-2xl">⭐</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Залишайте відгуки</h4>
                      <p className="text-sm text-gray-600">
                        20 балів за кожен відгук про товар
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="text-2xl">👥</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Запрошуйте друзів</h4>
                      <p className="text-sm text-gray-600">
                        100 балів за кожного реферала
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <div className="text-2xl">🎂</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">День народження</h4>
                      <p className="text-sm text-gray-600">
                        Отримайте бонусні бали у ваш день народження
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'rewards' && <LoyaltyRewards />}

          {activeTab === 'history' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                Історія балів
              </h3>
              {transactions.length > 0 ? (
                <div className="space-y-3">
                  {transactions.map(transaction => (
                    <div
                      key={transaction.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {transaction.descriptionUk}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(transaction.createdAt).toLocaleDateString('uk-UA', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        {transaction.expiresAt && (
                          <p className="text-xs text-gray-500">
                            Діють до {new Date(transaction.expiresAt).toLocaleDateString('uk-UA')}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <p
                          className={`text-lg font-bold ${
                            transaction.points > 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {transaction.points > 0 ? '+' : ''}
                          {formatPoints(transaction.points)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Баланс: {formatPoints(transaction.balance)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📋</div>
                  <p className="text-gray-600">Історія транзакцій порожня</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tiers' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">
                Рівні лояльності
              </h3>
              <div className="space-y-6">
                {LOYALTY_TIERS.map(tier => {
                  const isCurrent = currentTier?.id === tier.id;
                  const isUnlocked = member && member.points.lifetime >= tier.minPoints;

                  return (
                    <div
                      key={tier.id}
                      className={`border-2 rounded-lg p-6 transition-all ${
                        isCurrent
                          ? 'border-purple-500 bg-purple-50'
                          : isUnlocked
                          ? 'border-green-300 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <span className="text-4xl">{getTierIcon(tier.id)}</span>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className={getTierBadgeClasses(tier.id)}>
                                {tier.nameUk}
                              </span>
                              {isCurrent && (
                                <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs font-bold">
                                  ПОТОЧНИЙ
                                </span>
                              )}
                              {isUnlocked && !isCurrent && (
                                <span className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold">
                                  РОЗБЛОКОВАНО
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {tier.minPoints} - {tier.maxPoints || '∞'} балів
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Множник</p>
                          <p className="text-2xl font-bold text-purple-600">
                            ×{tier.multiplier}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {tier.benefits.map(benefit => (
                          <div
                            key={benefit.id}
                            className="flex items-start space-x-2 text-sm"
                          >
                            <svg
                              className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <div>
                              <p className="font-medium text-gray-900">
                                {benefit.nameUk}
                              </p>
                              <p className="text-gray-600 text-xs">
                                {benefit.descriptionUk}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
