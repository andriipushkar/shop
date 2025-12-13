'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  PlayIcon,
  PauseIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
} from '@heroicons/react/24/solid';

export interface ProductVideoProps {
  src: string;
  poster?: string;
  title?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
}

/**
 * Product Video Player Component
 * Optimized for product demos and reviews
 */
export default function ProductVideo({
  src,
  poster,
  title,
  autoPlay = false,
  muted = true,
  loop = true,
  className = '',
}: ProductVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Handle play/pause
  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  // Handle mute
  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Handle fullscreen
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      await containerRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  // Handle progress update
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
    setProgress(progress);
  };

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    videoRef.current.currentTime = percentage * videoRef.current.duration;
  };

  // Auto-hide controls
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (isPlaying) {
      timeout = setTimeout(() => setShowControls(false), 3000);
    } else {
      setShowControls(true);
    }

    return () => clearTimeout(timeout);
  }, [isPlaying, showControls]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative group rounded-xl overflow-hidden bg-black ${className}`}
      onMouseMove={() => setShowControls(true)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted={muted}
        loop={loop}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedData={() => setIsLoading(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="w-full h-full object-contain"
      />

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Play Button Overlay (when paused) */}
      {!isPlaying && !isLoading && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
        >
          <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <PlayIcon className="w-10 h-10 text-gray-900 ml-1" />
          </div>
        </button>
      )}

      {/* Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Progress Bar */}
        <div
          className="h-1 bg-white/30 rounded-full cursor-pointer mb-3 overflow-hidden"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-teal-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              {isPlaying ? (
                <PauseIcon className="w-5 h-5 text-white" />
              ) : (
                <PlayIcon className="w-5 h-5 text-white" />
              )}
            </button>

            <button
              onClick={toggleMute}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              {isMuted ? (
                <SpeakerXMarkIcon className="w-5 h-5 text-white" />
              ) : (
                <SpeakerWaveIcon className="w-5 h-5 text-white" />
              )}
            </button>

            {title && (
              <span className="text-white text-sm font-medium">{title}</span>
            )}
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            {isFullscreen ? (
              <ArrowsPointingInIcon className="w-5 h-5 text-white" />
            ) : (
              <ArrowsPointingOutIcon className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * 360° Product Viewer Component
 */
export interface Product360ViewerProps {
  images: string[];
  alt?: string;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  className?: string;
}

export function Product360Viewer({
  images,
  alt = 'Product 360° view',
  autoRotate = false,
  autoRotateSpeed = 100,
  className = '',
}: Product360ViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [isAutoRotating, setIsAutoRotating] = useState(autoRotate);

  // Auto-rotate effect
  useEffect(() => {
    if (!isAutoRotating || isDragging) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % images.length);
    }, autoRotateSpeed);

    return () => clearInterval(interval);
  }, [isAutoRotating, isDragging, images.length, autoRotateSpeed]);

  // Handle mouse/touch events
  const handleStart = (clientX: number) => {
    setIsDragging(true);
    setStartX(clientX);
    setIsAutoRotating(false);
  };

  const handleMove = (clientX: number) => {
    if (!isDragging) return;

    const diff = clientX - startX;
    const sensitivity = 5; // pixels per frame

    if (Math.abs(diff) > sensitivity) {
      const direction = diff > 0 ? -1 : 1;
      setCurrentIndex(prev => {
        const next = prev + direction;
        if (next < 0) return images.length - 1;
        if (next >= images.length) return 0;
        return next;
      });
      setStartX(clientX);
    }
  };

  const handleEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative select-none cursor-grab ${isDragging ? 'cursor-grabbing' : ''} ${className}`}
      onMouseDown={e => handleStart(e.clientX)}
      onMouseMove={e => handleMove(e.clientX)}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={e => handleStart(e.touches[0].clientX)}
      onTouchMove={e => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleEnd}
    >
      {/* Current Image */}
      <div className="relative aspect-square">
        <Image
          src={images[currentIndex]}
          alt={`${alt} - frame ${currentIndex + 1}`}
          fill
          className="object-contain pointer-events-none"
          draggable={false}
        />
      </div>

      {/* 360° Badge */}
      <div className="absolute top-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
        </svg>
        360°
      </div>

      {/* Frame Indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Instructions */}
      <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2 py-1 rounded">
        Перетягніть для обертання
      </div>

      {/* Auto-rotate toggle */}
      <button
        onClick={() => setIsAutoRotating(!isAutoRotating)}
        className={`absolute top-3 right-3 p-2 rounded-full transition-colors ${
          isAutoRotating ? 'bg-teal-500 text-white' : 'bg-black/70 text-white'
        }`}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 6v3l4-4-4-4v3c-4.42 0-8 3.58-8 8 0 1.57.46 3.03 1.24 4.26L6.7 14.8c-.45-.83-.7-1.79-.7-2.8 0-3.31 2.69-6 6-6zm6.76 1.74L17.3 9.2c.44.84.7 1.79.7 2.8 0 3.31-2.69 6-6 6v-3l-4 4 4 4v-3c4.42 0 8-3.58 8-8 0-1.57-.46-3.03-1.24-4.26z" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Product Media Gallery with Video Support
 */
export interface MediaItem {
  type: 'image' | 'video' | '360';
  src: string;
  thumbnail?: string;
  title?: string;
  images?: string[]; // For 360° view
}

export interface ProductMediaGalleryProps {
  items: MediaItem[];
  productName: string;
  className?: string;
}

export function ProductMediaGallery({
  items,
  productName,
  className = '',
}: ProductMediaGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedItem = items[selectedIndex];

  return (
    <div className={className}>
      {/* Main Viewer */}
      <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 mb-4">
        {selectedItem.type === 'video' ? (
          <ProductVideo
            src={selectedItem.src}
            poster={selectedItem.thumbnail}
            title={selectedItem.title}
            className="w-full h-full"
          />
        ) : selectedItem.type === '360' && selectedItem.images ? (
          <Product360Viewer
            images={selectedItem.images}
            alt={productName}
            className="w-full h-full"
          />
        ) : (
          <div className="relative w-full h-full">
            <Image
              src={selectedItem.src}
              alt={`${productName} - ${selectedIndex + 1}`}
              fill
              className="object-contain"
            />
          </div>
        )}
      </div>

      {/* Thumbnails */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {items.map((item, index) => (
          <button
            key={`media-thumb-${item.type}-${item.src}`}
            onClick={() => setSelectedIndex(index)}
            className={`relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
              selectedIndex === index
                ? 'border-teal-500 ring-2 ring-teal-200'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Image
              src={item.thumbnail || item.src}
              alt={`Thumbnail ${index + 1}`}
              fill
              className="object-cover"
            />
            {item.type === 'video' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <PlayIcon className="w-6 h-6 text-white" />
              </div>
            )}
            {item.type === '360' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <span className="text-white text-xs font-bold">360°</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
