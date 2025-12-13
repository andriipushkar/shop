'use client';

/**
 * LoyaltyCard Component
 * Displays user's current loyalty status, tier, points balance, and progress
 */

import React from 'react';
import { useLoyalty } from '../lib/loyalty/loyalty-context';
import {
  formatPoints,
  formatCurrency,
  getTierBadgeClasses,
  getTierIcon,
} from '../lib/loyalty/loyalty-program';

interface LoyaltyCardProps {
  variant?: 'compact' | 'full';
  showHistory?: boolean;
  className?: string;
}

export default function LoyaltyCard({
  variant = 'full',
  showHistory = false,
  className = ''
}: LoyaltyCardProps) {
  const {
    member,
    isLoading,
    isEnrolled,
    currentTier,
    nextTier,
    tierProgress,
    pointsToNextTier,
    availablePoints,
    expiringPoints,
  } = useLoyalty();

  if (isLoading) {
    return (
      <div className={`animate-pulse bg-gray-100 rounded-lg p-6 ${className}`}>
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  if (!isEnrolled || !member || !currentTier) {
    return (
      <div className={`bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200 ${className}`}>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Приєднайтесь до програми лояльності
        </h3>
        <p className="text-gray-600 mb-4">
          Отримуйте бали за покупки та використовуйте їх для знижок
        </p>
        <button className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors">
          Приєднатися зараз
        </button>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`bg-white rounded-lg shadow-sm p-4 border border-gray-200 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{getTierIcon(currentTier.id)}</span>
            <div>
              <div className={getTierBadgeClasses(currentTier.id)}>
                {currentTier.nameUk}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {formatPoints(availablePoints)} балів
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Вартість</p>
            <p className="text-lg font-bold text-purple-600">
              {formatCurrency(availablePoints)}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className="text-4xl">{getTierIcon(currentTier.id)}</span>
            <div>
              <h3 className="text-2xl font-bold">{currentTier.nameUk}</h3>
              <p className="text-purple-100 text-sm">Рівень лояльності</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{formatPoints(availablePoints)}</p>
            <p className="text-purple-100 text-sm">доступних балів</p>
          </div>
        </div>

        {/* Points Value */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">Вартість балів</p>
              <p className="text-2xl font-bold">{formatCurrency(availablePoints)}</p>
            </div>
            <div className="text-right">
              <p className="text-purple-100 text-sm">Множник балів</p>
              <p className="text-2xl font-bold">×{currentTier.multiplier}</p>
            </div>
          </div>
        </div>

        {/* Expiring Points Warning */}
        {expiringPoints.points > 0 && expiringPoints.expiryDate && (
          <div className="bg-yellow-500/20 border border-yellow-400/30 rounded-lg p-3 mb-4">
            <div className="flex items-start space-x-2">
              <span className="text-yellow-300 text-xl">⚠️</span>
              <div>
                <p className="text-yellow-100 font-semibold text-sm">
                  Закінчуються {formatPoints(expiringPoints.points)} балів
                </p>
                <p className="text-yellow-200 text-xs">
                  До {new Date(expiringPoints.expiryDate).toLocaleDateString('uk-UA', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tier Progress */}
        {nextTier && pointsToNextTier !== null && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-purple-100 text-sm">
                Прогрес до {nextTier.nameUk}
              </p>
              <p className="text-white text-sm font-semibold">
                {tierProgress}%
              </p>
            </div>
            <div className="bg-white/20 rounded-full h-3 overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all duration-500"
                style={{ width: `${tierProgress}%` }}
              />
            </div>
            <p className="text-purple-100 text-xs mt-1">
              Ще {formatPoints(pointsToNextTier)} балів до наступного рівня
            </p>
          </div>
        )}

        {/* Max Tier Badge */}
        {!nextTier && (
          <div className="text-center py-2">
            <span className="inline-flex items-center space-x-2 bg-yellow-400/20 border border-yellow-400/30 rounded-full px-4 py-2">
              <span className="text-yellow-300 text-xl">👑</span>
              <span className="text-yellow-100 font-semibold text-sm">
                Максимальний рівень досягнуто!
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Benefits */}
      <div className="bg-white p-6">
        <h4 className="font-bold text-gray-900 mb-3 flex items-center">
          <span className="text-lg">🎁</span>
          <span className="ml-2">Ваші переваги</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {currentTier.benefits.map((benefit) => (
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
                <p className="font-medium text-gray-900">{benefit.nameUk}</p>
                <p className="text-gray-600 text-xs">{benefit.descriptionUk}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity (if enabled) */}
      {showHistory && member && (
        <div className="bg-gray-50 p-6 border-t border-gray-200">
          <h4 className="font-bold text-gray-900 mb-3 flex items-center">
            <span className="text-lg">📊</span>
            <span className="ml-2">Статистика</span>
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {member.stats.totalOrders}
              </p>
              <p className="text-gray-600 text-xs">Замовлень</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(member.stats.totalSpent)}
              </p>
              <p className="text-gray-600 text-xs">Витрачено</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {formatPoints(member.stats.pointsEarned)}
              </p>
              <p className="text-gray-600 text-xs">Зароблено</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-600">
                {formatPoints(member.stats.pointsRedeemed)}
              </p>
              <p className="text-gray-600 text-xs">Використано</p>
            </div>
          </div>
        </div>
      )}

      {/* Member Since */}
      <div className="bg-gray-100 px-6 py-3 text-center">
        <p className="text-gray-600 text-xs">
          Учасник з {new Date(member.joinedAt).toLocaleDateString('uk-UA', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </p>
      </div>
    </div>
  );
}
