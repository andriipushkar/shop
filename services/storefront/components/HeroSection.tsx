'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    TruckIcon,
    ShieldCheckIcon,
    CreditCardIcon,
    ArrowPathIcon,
} from '@heroicons/react/24/outline';

const slides = [
    {
        id: 1,
        title: 'Зимовий розпродаж',
        subtitle: 'Знижки до 50% на зимову колекцію',
        description: 'Встигніть придбати найкращі товари за найнижчими цінами',
        buttonText: 'Переглянути',
        buttonLink: '/sale',
        bgGradient: 'from-teal-600 via-teal-500 to-teal-400',
        image: '🎄',
    },
    {
        id: 2,
        title: 'Нові надходження',
        subtitle: 'Електроніка 2025',
        description: 'Найновіші гаджети та пристрої вже у продажу',
        buttonText: 'Дивитись',
        buttonLink: '/category/electronics',
        bgGradient: 'from-blue-600 via-indigo-500 to-purple-500',
        image: '💻',
    },
    {
        id: 3,
        title: 'Безкоштовна доставка',
        subtitle: 'На замовлення від 1000 грн',
        description: 'Швидка доставка по всій Україні',
        buttonText: 'Замовити',
        buttonLink: '/',
        bgGradient: 'from-orange-500 via-amber-500 to-yellow-400',
        image: '🚚',
    },
];

const features = [
    {
        icon: TruckIcon,
        title: 'Безкоштовна доставка',
        description: 'При замовленні від 1000 грн',
    },
    {
        icon: ShieldCheckIcon,
        title: 'Гарантія якості',
        description: '30 днів на повернення',
    },
    {
        icon: CreditCardIcon,
        title: 'Безпечна оплата',
        description: 'Картки, Apple Pay, Google Pay',
    },
    {
        icon: ArrowPathIcon,
        title: 'Легке повернення',
        description: 'Без зайвих запитань',
    },
];

export default function HeroSection() {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);

    useEffect(() => {
        if (!isAutoPlaying) return;
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [isAutoPlaying]);

    const goToSlide = (index: number) => {
        setCurrentSlide(index);
        setIsAutoPlaying(false);
        setTimeout(() => setIsAutoPlaying(true), 10000);
    };

    const nextSlide = () => goToSlide((currentSlide + 1) % slides.length);
    const prevSlide = () => goToSlide((currentSlide - 1 + slides.length) % slides.length);

    return (
        <section className="relative">
            {/* Main Hero Slider */}
            <div className="relative overflow-hidden">
                <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                    {slides.map((slide) => (
                        <div
                            key={slide.id}
                            className={`min-w-full bg-gradient-to-r ${slide.bgGradient}`}
                        >
                            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                    <div className="text-white space-y-6 animate-slide-up">
                                        <span className="inline-block px-4 py-1 bg-white/20 rounded-full text-sm font-medium backdrop-blur-sm">
                                            {slide.subtitle}
                                        </span>
                                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
                                            {slide.title}
                                        </h1>
                                        <p className="text-lg md:text-xl text-white/90 max-w-md">
                                            {slide.description}
                                        </p>
                                        <div className="flex gap-4">
                                            <Link
                                                href={slide.buttonLink}
                                                className="inline-flex items-center px-8 py-4 bg-white text-gray-900 rounded-xl font-semibold hover:bg-gray-100 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                                            >
                                                {slide.buttonText}
                                            </Link>
                                            <Link
                                                href="/category/electronics"
                                                className="inline-flex items-center px-8 py-4 bg-white/20 text-white rounded-xl font-semibold hover:bg-white/30 transition-all duration-200 backdrop-blur-sm"
                                            >
                                                Каталог
                                            </Link>
                                        </div>
                                    </div>
                                    <div className="hidden md:flex justify-center items-center">
                                        <span className="text-[180px] animate-bounce-soft">
                                            {slide.image}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Navigation Arrows */}
                <button
                    onClick={prevSlide}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                    aria-label="Previous slide"
                >
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <button
                    onClick={nextSlide}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                    aria-label="Next slide"
                >
                    <ChevronRightIcon className="w-6 h-6" />
                </button>

                {/* Dots */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                    {slides.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goToSlide(index)}
                            className={`w-3 h-3 rounded-full transition-all duration-200 ${
                                currentSlide === index
                                    ? 'bg-white w-8'
                                    : 'bg-white/50 hover:bg-white/70'
                            }`}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            </div>

            {/* Features Bar */}
            <div className="bg-white border-y border-gray-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {features.map((feature, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-4 group"
                            >
                                <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                                    <feature.icon className="w-6 h-6 text-teal-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-sm">
                                        {feature.title}
                                    </h3>
                                    <p className="text-gray-500 text-xs">
                                        {feature.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
