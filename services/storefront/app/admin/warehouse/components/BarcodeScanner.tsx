'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CameraIcon,
  XMarkIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

interface BarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

export default function BarcodeScanner({ onScan, onClose, isOpen }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [scanHistory, setScanHistory] = useState<string[]>([]);

  // Звук сканування
  const playBeep = useCallback(() => {
    if (!soundEnabled) return;
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 1000;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1);
  }, [soundEnabled]);

  // Запуск камери
  const startCamera = useCallback(async () => {
    try {
      setError(null);

      // Зупиняємо попередній потік
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsScanning(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setError('Доступ до камери заборонено. Надайте дозвіл у налаштуваннях браузера.');
        } else if (err.name === 'NotFoundError') {
          setError('Камеру не знайдено. Переконайтесь, що пристрій має камеру.');
        } else {
          setError(`Помилка камери: ${err.message}`);
        }
      }
    }
  }, [facingMode]);

  // Зупинка камери
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  // Перемикання камери
  const switchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // Симуляція сканування (в реальному проекті тут буде бібліотека для розпізнавання)
  // Наприклад: @zxing/browser, quagga2, або html5-qrcode
  const simulateScan = useCallback(() => {
    // В реальному проекті тут буде логіка розпізнавання штрих-коду з відео
    // Для демонстрації генеруємо випадковий код
    const mockBarcodes = [
      '4820024700016',
      '4820024700023',
      '5901234123457',
      '7622210449283',
      '8710398501424',
    ];

    const randomBarcode = mockBarcodes[Math.floor(Math.random() * mockBarcodes.length)];

    if (randomBarcode !== lastScanned) {
      setLastScanned(randomBarcode);
      setScanHistory(prev => [randomBarcode, ...prev.slice(0, 9)]);
      playBeep();
      onScan(randomBarcode);
    }
  }, [lastScanned, playBeep, onScan]);

  // Ефект для запуску камери
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Ефект для перезапуску камери при зміні facingMode
  useEffect(() => {
    if (isOpen && isScanning) {
      startCamera();
    }
  }, [facingMode, isOpen, isScanning, startCamera]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Заголовок */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-lg font-semibold">Сканер штрих-коду</h2>
          <button
            onClick={onClose}
            className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Відео з камери */}
      <div className="relative h-full flex items-center justify-center">
        {error ? (
          <div className="text-center p-6">
            <ExclamationTriangleIcon className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <p className="text-white text-lg mb-4">{error}</p>
            <button
              onClick={startCamera}
              className="flex items-center gap-2 mx-auto px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              <ArrowPathIcon className="w-5 h-5" />
              Спробувати знову
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Рамка сканування */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-72 h-48">
                {/* Кути рамки */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-teal-500 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-teal-500 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-teal-500 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-teal-500 rounded-br-lg" />

                {/* Анімована лінія сканування */}
                {isScanning && (
                  <div className="absolute left-2 right-2 h-0.5 bg-teal-500 animate-scan" />
                )}
              </div>
            </div>

            {/* Останній відсканований код */}
            {lastScanned && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full flex items-center gap-2 animate-pulse">
                <CheckCircleIcon className="w-5 h-5" />
                {lastScanned}
              </div>
            )}
          </>
        )}
      </div>

      {/* Панель керування */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
        {/* Історія сканувань */}
        {scanHistory.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <div className="flex gap-2">
              {scanHistory.map((code, index) => (
                <span
                  key={`${code}-${index}`}
                  className="px-3 py-1 bg-white/20 text-white text-sm rounded-full whitespace-nowrap"
                >
                  {code}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Кнопки */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-3 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors"
            title={soundEnabled ? 'Вимкнути звук' : 'Увімкнути звук'}
          >
            {soundEnabled ? (
              <SpeakerWaveIcon className="w-6 h-6" />
            ) : (
              <SpeakerXMarkIcon className="w-6 h-6" />
            )}
          </button>

          {/* Кнопка сканування (для демонстрації) */}
          <button
            onClick={simulateScan}
            disabled={!isScanning}
            className="w-16 h-16 bg-teal-600 text-white rounded-full hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center transition-colors"
          >
            <CameraIcon className="w-8 h-8" />
          </button>

          <button
            onClick={switchCamera}
            className="p-3 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors"
            title="Перемкнути камеру"
          >
            <ArrowPathIcon className="w-6 h-6" />
          </button>
        </div>

        <p className="text-white/70 text-center text-sm mt-4">
          Наведіть камеру на штрих-код товару
        </p>
      </div>

      {/* CSS для анімації */}
      <style jsx>{`
        @keyframes scan {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// Компонент для введення штрих-коду вручну
interface ManualBarcodeInputProps {
  onSubmit: (barcode: string) => void;
  placeholder?: string;
}

export function ManualBarcodeInput({ onSubmit, placeholder = 'Введіть або відскануйте штрих-код...' }: ManualBarcodeInputProps) {
  const [barcode, setBarcode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcode.trim()) {
      onSubmit(barcode.trim());
      setBarcode('');
    }
  };

  // Автофокус на полі вводу для сканерів-пістолетів
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Якщо натиснуто цифру і фокус не на інпуті - фокусуємо
      if (/^\d$/.test(e.key) && document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={barcode}
        onChange={(e) => setBarcode(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2 pr-12 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={!barcode.trim()}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-teal-600 disabled:opacity-50"
      >
        <CheckCircleIcon className="w-5 h-5" />
      </button>
    </form>
  );
}
