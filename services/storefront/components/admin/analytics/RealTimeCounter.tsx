'use client';

import React, { useState, useEffect } from 'react';
import { UsersIcon } from '@heroicons/react/24/solid';

interface RealTimeCounterProps {
  interval?: number; // оновлення в мілісекундах
}

export default function RealTimeCounter({ interval = 5000 }: RealTimeCounterProps) {
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchActiveUsers = async () => {
      try {
        const response = await fetch('/api/admin/analytics/active-users');
        if (response.ok) {
          const data = await response.json();
          setActiveUsers(data.count || 0);
        }
      } catch (error) {
        console.error('Failed to fetch active users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Перше завантаження
    fetchActiveUsers();

    // Періодичне оновлення
    const intervalId = setInterval(fetchActiveUsers, interval);

    return () => clearInterval(intervalId);
  }, [interval]);

  return (
    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-blue-100 mb-1">
            Активні користувачі
          </p>
          <div className="flex items-center">
            {isLoading ? (
              <div className="animate-pulse">
                <div className="h-10 w-20 bg-blue-400 rounded"></div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <span className="text-4xl font-bold">{activeUsers}</span>
                  <span className="absolute -top-1 -right-6 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                </div>
              </>
            )}
          </div>
          <p className="text-xs text-blue-100 mt-2">
            Зараз на сайті
          </p>
        </div>
        <div className="ml-4">
          <div className="w-16 h-16 bg-blue-400 bg-opacity-30 rounded-full flex items-center justify-center">
            <UsersIcon className="w-8 h-8 text-white" />
          </div>
        </div>
      </div>

      {/* Індикатор оновлення */}
      <div className="mt-4 flex items-center justify-between text-xs text-blue-100">
        <span>Оновлюється кожні {interval / 1000}с</span>
        <div className="flex items-center">
          <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse"></span>
          <span>Онлайн</span>
        </div>
      </div>
    </div>
  );
}
