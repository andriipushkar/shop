'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  QrCodeIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  LinkIcon,
  CheckCircleIcon,
  XMarkIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  SignalIcon,
  WifiIcon,
} from '@heroicons/react/24/outline';

// Генерація унікального ID сесії
function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Типи
interface ScanEvent {
  id: string;
  barcode: string;
  timestamp: Date;
  synced: boolean;
}

interface ScannerSession {
  id: string;
  createdAt: Date;
  lastActivity: Date;
  scans: ScanEvent[];
  isActive: boolean;
}

export default function ScannerPage() {
  const [mode, setMode] = useState<'select' | 'desktop' | 'mobile'>('select');
  const [sessionId, setSessionId] = useState<string>('');
  const [inputSessionId, setInputSessionId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [scans, setScans] = useState<ScanEvent[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [lastScan, setLastScan] = useState<string>('');
  const [origin, setOrigin] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Отримання origin URL на клієнті
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Автоматичне підключення через URL параметр
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionParam = urlParams.get('session');

      if (sessionParam && sessionParam.length === 6) {
        const storageKey = `wms_scanner_${sessionParam.toUpperCase()}`;
        const existing = localStorage.getItem(storageKey);

        if (existing) {
          setSessionId(sessionParam.toUpperCase());
          setMode('mobile');
          setIsConnected(true);
          // Очищуємо URL параметр
          window.history.replaceState({}, '', window.location.pathname);
        }
      }
    }
  }, []);

  // Ініціалізація аудіо контексту
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  // Звуковий сигнал
  const playBeep = useCallback(() => {
    if (!soundEnabled || !audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = 1200;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.1);
  }, [soundEnabled]);

  // LocalStorage синхронізація для демо (в реальному проекті - WebSocket)
  useEffect(() => {
    if (!sessionId || mode === 'select') return;

    const storageKey = `wms_scanner_${sessionId}`;

    // Слухаємо зміни в localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        const data = JSON.parse(e.newValue);
        setScans(data.scans || []);
        // Встановлюємо isConnected коли мобільний підключився
        if (data.mobileConnected) {
          setIsConnected(true);
        }

        // Якщо це десктоп і прийшов новий скан
        if (mode === 'desktop' && data.scans?.length > scans.length) {
          const newScan = data.scans[data.scans.length - 1];
          if (newScan && !newScan.synced) {
            playBeep();
            // Позначаємо як синхронізований
            const updatedScans = data.scans.map((s: ScanEvent) => ({ ...s, synced: true }));
            localStorage.setItem(storageKey, JSON.stringify({ ...data, scans: updatedScans }));
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Перевіряємо існуючу сесію
    const existing = localStorage.getItem(storageKey);
    if (existing) {
      const data = JSON.parse(existing);
      setScans(data.scans || []);
      // Встановлюємо isConnected тільки якщо мобільний пристрій реально підключився
      if (data.mobileConnected) {
        setIsConnected(true);
      }
    } else if (mode === 'desktop') {
      // Створюємо нову сесію
      localStorage.setItem(storageKey, JSON.stringify({
        id: sessionId,
        createdAt: new Date().toISOString(),
        scans: [],
        isActive: true,
        mobileConnected: false,
      }));
    }

    // Heartbeat для перевірки з'єднання
    const heartbeat = setInterval(() => {
      const data = localStorage.getItem(storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        parsed.lastActivity = new Date().toISOString();
        localStorage.setItem(storageKey, JSON.stringify(parsed));
      }
    }, 5000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(heartbeat);
    };
  }, [sessionId, mode, scans.length, playBeep]);

  // Запуск камери
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      alert('Не вдалося отримати доступ до камери');
    }
  };

  // Зупинка камери
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setCameraActive(false);
    }
  };

  // Симуляція сканування (в реальному проекті - бібліотека типу @zxing/library)
  const handleManualScan = (barcode: string) => {
    if (!barcode.trim()) return;

    const storageKey = `wms_scanner_${sessionId}`;
    const existing = localStorage.getItem(storageKey);

    if (existing) {
      const data = JSON.parse(existing);
      const newScan: ScanEvent = {
        id: Math.random().toString(36).substring(7),
        barcode: barcode.trim(),
        timestamp: new Date(),
        synced: false,
      };

      data.scans = [...(data.scans || []), newScan];
      data.lastActivity = new Date().toISOString();

      localStorage.setItem(storageKey, JSON.stringify(data));
      setScans(data.scans);
      setLastScan(barcode);
      playBeep();

      // Триггеримо storage event для інших вкладок
      window.dispatchEvent(new StorageEvent('storage', {
        key: storageKey,
        newValue: JSON.stringify(data),
      }));
    }
  };

  // Створення десктоп сесії
  const createDesktopSession = () => {
    const newSessionId = generateSessionId();
    const storageKey = `wms_scanner_${newSessionId}`;

    // Одразу створюємо сесію в localStorage
    const sessionData = {
      id: newSessionId,
      createdAt: new Date().toISOString(),
      scans: [],
      isActive: true,
    };
    localStorage.setItem(storageKey, JSON.stringify(sessionData));

    // Діагностика
    console.log('Created session:', newSessionId);
    console.log('Storage key:', storageKey);
    console.log('Saved data:', localStorage.getItem(storageKey));

    setSessionId(newSessionId);
    setMode('desktop');
  };

  // Підключення до сесії з мобільного
  const connectMobile = () => {
    if (inputSessionId.length !== 6) {
      alert('Введіть 6-значний код сесії');
      return;
    }

    const storageKey = `wms_scanner_${inputSessionId.toUpperCase()}`;
    const existing = localStorage.getItem(storageKey);

    // Діагностика
    console.log('Looking for session:', inputSessionId.toUpperCase());
    console.log('Storage key:', storageKey);
    console.log('Found:', existing);
    console.log('All localStorage keys:', Object.keys(localStorage));

    if (!existing) {
      alert('Сесію не знайдено. Перевірте код.');
      return;
    }

    // Оновлюємо сесію - позначаємо що мобільний підключився
    const data = JSON.parse(existing);
    data.mobileConnected = true;
    localStorage.setItem(storageKey, JSON.stringify(data));

    // Триггеримо storage event для десктопу
    window.dispatchEvent(new StorageEvent('storage', {
      key: storageKey,
      newValue: JSON.stringify(data),
    }));

    setSessionId(inputSessionId.toUpperCase());
    setMode('mobile');
    setIsConnected(true);
  };

  // Очищення сканів
  const clearScans = () => {
    const storageKey = `wms_scanner_${sessionId}`;
    const existing = localStorage.getItem(storageKey);

    if (existing) {
      const data = JSON.parse(existing);
      data.scans = [];
      localStorage.setItem(storageKey, JSON.stringify(data));
      setScans([]);
    }
  };

  // Копіювання коду сесії
  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId);
  };

  // UI для вибору режиму
  if (mode === 'select') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <QrCodeIcon className="h-16 w-16 text-teal-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Сканер штрих-кодів</h1>
            <p className="text-gray-600 mt-2">
              Скануйте товари телефоном та отримуйте дані на комп'ютері
            </p>
          </div>

          <div className="space-y-4">
            {/* Десктоп режим */}
            <button
              onClick={createDesktopSession}
              className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:border-teal-500 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-teal-50 rounded-lg">
                  <ComputerDesktopIcon className="h-8 w-8 text-teal-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Я на комп'ютері</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Створіть сесію та отримайте код для підключення телефону
                  </p>
                </div>
              </div>
            </button>

            {/* Мобільний режим */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <DevicePhoneMobileIcon className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Я на телефоні</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Введіть код сесії з комп'ютера для підключення
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputSessionId}
                  onChange={(e) => setInputSessionId(e.target.value.toUpperCase())}
                  placeholder="Код сесії (6 символів)"
                  maxLength={6}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-center text-xl font-mono tracking-widest uppercase"
                />
                <button
                  onClick={connectMobile}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  <LinkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-teal-50 rounded-lg">
            <h4 className="font-medium text-teal-900 mb-2">Як це працює:</h4>
            <ol className="text-sm text-teal-800 space-y-1 list-decimal list-inside">
              <li>Відкрийте цю сторінку на комп'ютері та створіть сесію</li>
              <li>Відкрийте цю сторінку на телефоні та введіть код</li>
              <li>Скануйте штрих-коди телефоном</li>
              <li>Дані автоматично з'являться на комп'ютері</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // UI для десктоп режиму
  if (mode === 'desktop') {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Заголовок */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ComputerDesktopIcon className="h-8 w-8 text-teal-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Режим прийому сканів</h1>
                <p className="text-sm text-gray-500">Очікування сканів з мобільного пристрою</p>
              </div>
            </div>
            <button
              onClick={() => { setMode('select'); setSessionId(''); setScans([]); }}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Код сесії з QR-кодом */}
          <div className="bg-gradient-to-r from-teal-500 to-teal-600 rounded-xl p-6 mb-6 text-white">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <p className="text-teal-100 text-sm mb-1">Код для підключення телефону:</p>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl font-mono font-bold tracking-[0.3em]">{sessionId}</span>
                  <button
                    onClick={copySessionId}
                    className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                    title="Копіювати"
                  >
                    <ClipboardDocumentIcon className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  {isConnected ? (
                    <>
                      <SignalIcon className="h-6 w-6 text-green-300 animate-pulse" />
                      <span className="text-green-300 font-medium">Телефон підключено!</span>
                    </>
                  ) : (
                    <>
                      <WifiIcon className="h-6 w-6 text-teal-200 animate-pulse" />
                      <span className="text-teal-200">Очікування підключення...</span>
                    </>
                  )}
                </div>
                <div className="text-teal-100 text-sm space-y-1">
                  <p><strong>Варіант 1:</strong> Відскануйте QR-код телефоном →</p>
                  <p><strong>Варіант 2:</strong> Відкрийте цю сторінку на телефоні та введіть код</p>
                </div>
              </div>

              {/* QR-код */}
              <div className="bg-white p-3 rounded-xl shadow-lg">
                {origin ? (
                  <QRCodeSVG
                    value={`${origin}/admin/warehouse/scanner?session=${sessionId}`}
                    size={150}
                    level="M"
                    includeMargin={false}
                  />
                ) : (
                  <div className="w-[150px] h-[150px] bg-gray-100 animate-pulse rounded" />
                )}
                <p className="text-center text-xs text-gray-500 mt-2">Скануйте телефоном</p>
              </div>
            </div>
          </div>

          {/* Налаштування */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              Отримані скани ({scans.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-lg ${soundEnabled ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-400'}`}
                title={soundEnabled ? 'Вимкнути звук' : 'Увімкнути звук'}
              >
                {soundEnabled ? <SpeakerWaveIcon className="h-5 w-5" /> : <SpeakerXMarkIcon className="h-5 w-5" />}
              </button>
              {scans.length > 0 && (
                <button
                  onClick={clearScans}
                  className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Очистити
                </button>
              )}
            </div>
          </div>

          {/* Список сканів */}
          {scans.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-12 text-center">
              <QrCodeIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Скани ще не отримані</p>
              <p className="text-sm text-gray-400 mt-1">Підключіть телефон та почніть сканувати</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">№</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Штрих-код</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Час</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {scans.slice().reverse().map((scan, index) => (
                    <tr key={scan.id} className={index === 0 ? 'bg-teal-50' : ''}>
                      <td className="px-4 py-3 text-sm text-gray-500">{scans.length - index}</td>
                      <td className="px-4 py-3 font-mono text-sm font-medium text-gray-900">{scan.barcode}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(scan.timestamp).toLocaleTimeString('uk-UA')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          <CheckCircleIcon className="h-3 w-3" />
                          Отримано
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Останній скан (великий) */}
          {lastScan && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-sm text-green-600 mb-1">Останній скан:</p>
              <p className="text-2xl font-mono font-bold text-green-800">{lastScan}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // UI для мобільного режиму
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Заголовок */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DevicePhoneMobileIcon className="h-5 w-5 text-blue-400" />
          <span className="font-medium">Сканер</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Сесія:</span>
          <span className="font-mono text-blue-400">{sessionId}</span>
          {isConnected && <SignalIcon className="h-4 w-4 text-green-400" />}
        </div>
        <button
          onClick={() => { setMode('select'); setSessionId(''); setScans([]); stopCamera(); }}
          className="p-2"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Камера */}
      <div className="relative aspect-[4/3] bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {!cameraActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={startCamera}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg flex items-center gap-2"
            >
              <QrCodeIcon className="h-5 w-5" />
              Увімкнути камеру
            </button>
          </div>
        )}

        {/* Рамка прицілу */}
        {cameraActive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-32 border-2 border-blue-400 rounded-lg">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
            </div>
          </div>
        )}
      </div>

      {/* Ручний ввід */}
      <div className="p-4">
        <p className="text-xs text-gray-400 mb-2 text-center">
          Або введіть штрих-код вручну:
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem('barcode') as HTMLInputElement;
            handleManualScan(input.value);
            input.value = '';
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            name="barcode"
            placeholder="Штрих-код..."
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500"
            autoComplete="off"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium"
          >
            Надіслати
          </button>
        </form>
      </div>

      {/* Останній скан */}
      {lastScan && (
        <div className="mx-4 p-3 bg-green-900/50 border border-green-700 rounded-lg">
          <p className="text-xs text-green-400">Відскановано:</p>
          <p className="font-mono text-lg text-green-300">{lastScan}</p>
        </div>
      )}

      {/* Налаштування */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
              soundEnabled ? 'bg-blue-600' : 'bg-gray-700'
            }`}
          >
            {soundEnabled ? (
              <SpeakerWaveIcon className="h-5 w-5" />
            ) : (
              <SpeakerXMarkIcon className="h-5 w-5" />
            )}
            <span className="text-sm">Звук</span>
          </button>

          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>Відскановано: {scans.length}</span>
          </div>

          {cameraActive && (
            <button
              onClick={stopCamera}
              className="px-3 py-2 bg-red-600 rounded-lg text-sm"
            >
              Стоп
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
