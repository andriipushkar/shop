'use client';

/**
 * LoyaltyRewards Component
 * Displays available rewards, tier-specific perks, and point multiplier events
 */

import React, { useState } from 'react';
import { useLoyalty } from '../lib/loyalty/loyalty-context';
import { Reward, RewardType } from '../lib/loyalty';
import { formatPoints, formatCurrency } from '../lib/loyalty/loyalty-program';

// Mock rewards data (in production, this would come from API)
const AVAILABLE_REWARDS: Reward[] = [
  {
    id: 'reward_1',
    name: '5% Discount',
    nameUk: '5% Знижка',
    description: '5% off your next purchase',
    descriptionUk: '5% знижки на наступну покупку',
    type: 'discount_percent',
    pointsCost: 500,
    value: 5,
    available: true,
    validDays: 30,
    maxPerUser: 3,
  },
  {
    id: 'reward_2',
    name: '100 UAH Discount',
    nameUk: '100 грн Знижка',
    description: '100 UAH off orders above 1000 UAH',
    descriptionUk: '100 грн знижки на замовлення від 1000 грн',
    type: 'discount_fixed',
    pointsCost: 1000,
    value: 100,
    available: true,
    validDays: 30,
    maxPerUser: 5,
  },
  {
    id: 'reward_3',
    name: 'Free Shipping',
    nameUk: 'Безкоштовна доставка',
    description: 'Free shipping on your next order',
    descriptionUk: 'Безкоштовна доставка на наступне замовлення',
    type: 'free_shipping',
    pointsCost: 300,
    available: true,
    validDays: 14,
    maxPerUser: 10,
  },
  {
    id: 'reward_4',
    name: '200 UAH Gift Card',
    nameUk: 'Подарунковий сертифікат 200 грн',
    description: '200 UAH gift card',
    descriptionUk: 'Подарунковий сертифікат на 200 грн',
    type: 'gift_card',
    pointsCost: 2000,
    value: 200,
    available: true,
    stock: 50,
    maxPerUser: 2,
  },
  {
    id: 'reward_5',
    name: 'VIP Support for 3 Months',
    nameUk: 'VIP підтримка на 3 місяці',
    description: 'Priority customer support for 3 months',
    descriptionUk: 'Пріоритетна підтримка клієнтів на 3 місяці',
    type: 'upgrade',
    pointsCost: 1500,
    available: true,
    requiredTier: 'gold',
    validDays: 90,
    maxPerUser: 1,
  },
  {
    id: 'reward_6',
    name: '10% Discount',
    nameUk: '10% Знижка',
    description: '10% off your next purchase',
    descriptionUk: '10% знижки на наступну покупку',
    type: 'discount_percent',
    pointsCost: 800,
    value: 10,
    available: true,
    requiredTier: 'silver',
    validDays: 30,
    maxPerUser: 2,
  },
];

const POINT_MULTIPLIER_EVENTS = [
  {
    id: 'event_1',
    name: 'Подвійні бали на вихідних',
    description: 'Отримуйте x2 бали за покупки у суботу та неділю',
    multiplier: 2,
    startDate: new Date('2025-12-13'),
    endDate: new Date('2025-12-15'),
    active: true,
  },
  {
    id: 'event_2',
    name: 'Потрійні бали на електроніку',
    description: 'x3 бали на всі товари категорії "Електроніка"',
    multiplier: 3,
    categories: ['electronics'],
    startDate: new Date('2025-12-10'),
    endDate: new Date('2025-12-20'),
    active: true,
  },
];

function getRewardIcon(type: RewardType): string {
  switch (type) {
    case 'discount_percent':
    case 'discount_fixed':
      return '💰';
    case 'free_shipping':
      return '🚚';
    case 'free_product':
      return '🎁';
    case 'gift_card':
      return '💳';
    case 'upgrade':
      return '⭐';
    case 'experience':
      return '🎉';
    default:
      return '🎁';
  }
}

export default function LoyaltyRewards() {
  const { availablePoints, currentTier, isEnrolled } = useLoyalty();
  const [selectedReward, setSelectedReward] = useState<string | null>(null);
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  if (!isEnrolled || !currentTier) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <div className="text-6xl mb-4">🎁</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Приєднайтесь до програми лояльності
        </h3>
        <p className="text-gray-600 mb-4">
          Отримуйте доступ до ексклюзивних винагород та переваг
        </p>
      </div>
    );
  }

  // Filter rewards based on tier
  const availableRewardsForTier = AVAILABLE_REWARDS.filter(reward => {
    if (!reward.available) return false;
    if (!reward.requiredTier) return true;

    const tierLevels: Record<string, number> = {
      bronze: 0,
      silver: 1,
      gold: 2,
      platinum: 3,
      vip: 4,
    };

    return tierLevels[currentTier.id] >= tierLevels[reward.requiredTier];
  });

  const handleRedeemClick = (rewardId: string) => {
    setSelectedReward(rewardId);
    setShowRedeemModal(true);
  };

  const handleRedeem = async () => {
    if (!selectedReward) return;

    const reward = AVAILABLE_REWARDS.find(r => r.id === selectedReward);
    if (!reward) return;

    // In production, this would call an API
    console.log('Redeeming reward:', reward);

    // Close modal
    setShowRedeemModal(false);
    setSelectedReward(null);

    // Show success message (in production, use a toast/notification)
    alert(`Винагороду "${reward.nameUk}" успішно активовано!`);
  };

  const selectedRewardData = selectedReward
    ? AVAILABLE_REWARDS.find(r => r.id === selectedReward)
    : null;

  return (
    <div className="space-y-6">
      {/* Point Multiplier Events */}
      {POINT_MULTIPLIER_EVENTS.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-6 border border-yellow-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <span className="text-2xl mr-2">🔥</span>
            Активні акції з балами
          </h3>
          <div className="space-y-3">
            {POINT_MULTIPLIER_EVENTS.filter(e => e.active).map(event => (
              <div
                key={event.id}
                className="bg-white rounded-lg p-4 border border-yellow-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">
                      {event.name}
                    </h4>
                    <p className="text-sm text-gray-600 mb-2">
                      {event.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      До {event.endDate.toLocaleDateString('uk-UA', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="ml-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-orange-500 text-white">
                      ×{event.multiplier}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Rewards */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">
            Доступні винагороди
          </h3>
          <div className="text-right">
            <p className="text-sm text-gray-600">Ваші бали</p>
            <p className="text-2xl font-bold text-purple-600">
              {formatPoints(availablePoints)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableRewardsForTier.map(reward => {
            const canAfford = availablePoints >= reward.pointsCost;

            return (
              <div
                key={reward.id}
                className={`border rounded-lg p-4 transition-all ${
                  canAfford
                    ? 'border-purple-200 hover:border-purple-400 hover:shadow-md'
                    : 'border-gray-200 opacity-60'
                }`}
              >
                <div className="text-4xl mb-3">{getRewardIcon(reward.type)}</div>

                <h4 className="font-bold text-gray-900 mb-1">
                  {reward.nameUk}
                </h4>

                <p className="text-sm text-gray-600 mb-3">
                  {reward.descriptionUk}
                </p>

                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-500">Вартість</p>
                    <p className="text-lg font-bold text-purple-600">
                      {formatPoints(reward.pointsCost)}
                    </p>
                  </div>
                  {reward.value && (
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Значення</p>
                      <p className="text-lg font-bold text-green-600">
                        {reward.type.includes('percent')
                          ? `${reward.value}%`
                          : formatCurrency(reward.value)}
                      </p>
                    </div>
                  )}
                </div>

                {reward.validDays && (
                  <p className="text-xs text-gray-500 mb-3">
                    Дійсно {reward.validDays} днів після активації
                  </p>
                )}

                {reward.stock !== undefined && (
                  <p className="text-xs text-gray-500 mb-3">
                    Залишилось: {reward.stock} шт.
                  </p>
                )}

                <button
                  onClick={() => handleRedeemClick(reward.id)}
                  disabled={!canAfford}
                  className={`w-full py-2 rounded-lg font-semibold transition-colors ${
                    canAfford
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {canAfford ? 'Активувати' : 'Недостатньо балів'}
                </button>
              </div>
            );
          })}
        </div>

        {availableRewardsForTier.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎁</div>
            <p className="text-gray-600">
              Наразі немає доступних винагород для вашого рівня
            </p>
          </div>
        )}
      </div>

      {/* Tier-Specific Perks */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <span className="text-2xl mr-2">⭐</span>
          Переваги вашого рівня
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {currentTier.benefits.map(benefit => (
            <div
              key={benefit.id}
              className="flex items-start space-x-3 bg-white rounded-lg p-3"
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
                <p className="font-medium text-gray-900 text-sm">
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

      {/* Redeem Modal */}
      {showRedeemModal && selectedRewardData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Підтвердіть активацію
            </h3>

            <div className="mb-6">
              <div className="text-5xl text-center mb-4">
                {getRewardIcon(selectedRewardData.type)}
              </div>
              <h4 className="font-bold text-center text-gray-900 mb-2">
                {selectedRewardData.nameUk}
              </h4>
              <p className="text-center text-gray-600 text-sm mb-4">
                {selectedRewardData.descriptionUk}
              </p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Вартість:</span>
                  <span className="font-bold text-purple-600">
                    {formatPoints(selectedRewardData.pointsCost)} балів
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Залишок після активації:</span>
                  <span className="font-bold text-gray-900">
                    {formatPoints(availablePoints - selectedRewardData.pointsCost)} балів
                  </span>
                </div>
                {selectedRewardData.validDays && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Дійсно:</span>
                    <span className="font-bold text-gray-900">
                      {selectedRewardData.validDays} днів
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowRedeemModal(false);
                  setSelectedReward(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Скасувати
              </button>
              <button
                onClick={handleRedeem}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Підтвердити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
