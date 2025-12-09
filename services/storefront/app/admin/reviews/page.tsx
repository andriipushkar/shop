'use client';

import { useState } from 'react';
import {
    MagnifyingGlassIcon,
    StarIcon,
    CheckCircleIcon,
    XCircleIcon,
    EyeIcon,
    TrashIcon,
    ChatBubbleLeftIcon,
    FlagIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

type ReviewStatus = 'pending' | 'approved' | 'rejected';

interface Review {
    id: number;
    productId: string;
    productName: string;
    customerName: string;
    customerEmail: string;
    rating: number;
    title: string;
    text: string;
    date: string;
    status: ReviewStatus;
    helpful: number;
    reported: boolean;
    reply: string | null;
}

const reviewsData: Review[] = [
    { id: 1, productId: '1', productName: 'iPhone 15 Pro Max 256GB', customerName: 'Олександр К.', customerEmail: 'o.k@gmail.com', rating: 5, title: 'Відмінний телефон!', text: 'Дуже задоволений покупкою. Камера просто супер, батарея тримає весь день. Рекомендую!', date: '10.12.2024', status: 'approved', helpful: 12, reported: false, reply: null },
    { id: 2, productId: '2', productName: 'Samsung Galaxy S24 Ultra', customerName: 'Марія С.', customerEmail: 'm.s@gmail.com', rating: 4, title: 'Хороший, але дорогий', text: 'Телефон гарний, але ціна завищена. Функціонал не виправдовує таку вартість.', date: '10.12.2024', status: 'pending', helpful: 3, reported: false, reply: null },
    { id: 3, productId: '1', productName: 'iPhone 15 Pro Max 256GB', customerName: 'Андрій П.', customerEmail: 'a.p@ukr.net', rating: 5, title: 'Найкращий смартфон', text: 'Перейшов з Android і не шкодую. Все працює швидко і плавно.', date: '09.12.2024', status: 'approved', helpful: 8, reported: false, reply: 'Дякуємо за відгук! Раді, що вам сподобався!' },
    { id: 4, productId: '3', productName: 'MacBook Pro 14" M3', customerName: 'Наталія Б.', customerEmail: 'n.b@gmail.com', rating: 2, title: 'Не виправдав очікувань', text: 'За таку ціну очікувала більшого. Батарея сідає швидше ніж заявлено.', date: '09.12.2024', status: 'pending', helpful: 1, reported: true, reply: null },
    { id: 5, productId: '4', productName: 'Sony WH-1000XM5', customerName: 'Віктор М.', customerEmail: 'v.m@i.ua', rating: 5, title: 'Найкращі навушники', text: 'Шумоподавлення на вищому рівні. Звук чистий і деталізований. Комфортні навіть після декількох годин носіння.', date: '08.12.2024', status: 'approved', helpful: 15, reported: false, reply: null },
    { id: 6, productId: '5', productName: 'Apple Watch Ultra 2', customerName: 'Іван П.', customerEmail: 'i.p@gmail.com', rating: 4, title: 'Гарний годинник для спорту', text: 'Відмінно підходить для тренувань. GPS точний, батарея тримає добре.', date: '08.12.2024', status: 'approved', helpful: 6, reported: false, reply: null },
    { id: 7, productId: '2', productName: 'Samsung Galaxy S24 Ultra', customerName: 'Анонім', customerEmail: 'spam@test.com', rating: 1, title: 'СПАМ', text: 'Купуйте тут дешевше www.spam.com', date: '07.12.2024', status: 'rejected', helpful: 0, reported: true, reply: null },
];

export default function AdminReviewsPage() {
    const [reviews, setReviews] = useState(reviewsData);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<'all' | ReviewStatus>('all');
    const [selectedRating, setSelectedRating] = useState<number | 'all'>('all');
    const [showReplyModal, setShowReplyModal] = useState(false);
    const [selectedReview, setSelectedReview] = useState<Review | null>(null);
    const [replyText, setReplyText] = useState('');

    const filteredReviews = reviews.filter(review => {
        const matchesSearch = review.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            review.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            review.text.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = selectedStatus === 'all' || review.status === selectedStatus;
        const matchesRating = selectedRating === 'all' || review.rating === selectedRating;
        return matchesSearch && matchesStatus && matchesRating;
    });

    const updateStatus = (id: number, status: ReviewStatus) => {
        setReviews(reviews.map(r => r.id === id ? { ...r, status } : r));
    };

    const deleteReview = (id: number) => {
        if (confirm('Ви впевнені, що хочете видалити цей відгук?')) {
            setReviews(reviews.filter(r => r.id !== id));
        }
    };

    const handleReply = () => {
        if (selectedReview && replyText.trim()) {
            setReviews(reviews.map(r =>
                r.id === selectedReview.id ? { ...r, reply: replyText } : r
            ));
            setShowReplyModal(false);
            setReplyText('');
            setSelectedReview(null);
        }
    };

    const getStatusBadge = (status: ReviewStatus) => {
        switch (status) {
            case 'approved':
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Схвалено</span>;
            case 'pending':
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Очікує</span>;
            case 'rejected':
                return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Відхилено</span>;
        }
    };

    const renderStars = (rating: number) => {
        return (
            <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                    star <= rating ? (
                        <StarSolidIcon key={star} className="w-4 h-4 text-yellow-400" />
                    ) : (
                        <StarIcon key={star} className="w-4 h-4 text-gray-300" />
                    )
                ))}
            </div>
        );
    };

    // Stats
    const stats = {
        total: reviews.length,
        pending: reviews.filter(r => r.status === 'pending').length,
        avgRating: (reviews.filter(r => r.status === 'approved').reduce((sum, r) => sum + r.rating, 0) / reviews.filter(r => r.status === 'approved').length).toFixed(1),
        reported: reviews.filter(r => r.reported).length,
    };

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Відгуки</h1>
                <p className="text-gray-600">Модерація відгуків клієнтів</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                            <ChatBubbleLeftIcon className="w-5 h-5 text-teal-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                            <p className="text-sm text-gray-500">Всього відгуків</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                            <StarIcon className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                            <p className="text-sm text-gray-500">Очікують модерації</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <StarSolidIcon className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.avgRating}</p>
                            <p className="text-sm text-gray-500">Середній рейтинг</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <FlagIcon className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900">{stats.reported}</p>
                            <p className="text-sm text-gray-500">Скарги</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1 relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Пошук за товаром, автором або текстом..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                        />
                    </div>
                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value as typeof selectedStatus)}
                        className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                        <option value="all">Всі статуси</option>
                        <option value="pending">Очікують</option>
                        <option value="approved">Схвалені</option>
                        <option value="rejected">Відхилені</option>
                    </select>
                    <select
                        value={selectedRating}
                        onChange={(e) => setSelectedRating(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                        className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    >
                        <option value="all">Всі оцінки</option>
                        <option value="5">5 зірок</option>
                        <option value="4">4 зірки</option>
                        <option value="3">3 зірки</option>
                        <option value="2">2 зірки</option>
                        <option value="1">1 зірка</option>
                    </select>
                </div>
            </div>

            {/* Reviews list */}
            <div className="space-y-4">
                {filteredReviews.map((review) => (
                    <div key={review.id} className={`bg-white rounded-xl shadow-sm p-6 ${review.reported ? 'ring-2 ring-red-200' : ''}`}>
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
                                    <span className="text-teal-700 font-medium">
                                        {review.customerName.split(' ').map(n => n[0]).join('')}
                                    </span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-gray-900">{review.customerName}</p>
                                        {review.reported && (
                                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded flex items-center gap-1">
                                                <FlagIcon className="w-3 h-3" />
                                                Скарга
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500">{review.customerEmail}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {renderStars(review.rating)}
                                        <span className="text-sm text-gray-500">{review.date}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {getStatusBadge(review.status)}
                            </div>
                        </div>

                        <div className="mb-4">
                            <p className="text-sm text-gray-500 mb-1">Товар: <span className="text-teal-600">{review.productName}</span></p>
                            <p className="font-medium text-gray-900">{review.title}</p>
                            <p className="text-gray-600 mt-1">{review.text}</p>
                        </div>

                        {review.reply && (
                            <div className="bg-teal-50 rounded-lg p-4 mb-4">
                                <p className="text-sm font-medium text-teal-900 mb-1">Відповідь магазину:</p>
                                <p className="text-sm text-teal-700">{review.reply}</p>
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-4 border-t">
                            <p className="text-sm text-gray-500">
                                {review.helpful} людей вважають корисним
                            </p>
                            <div className="flex items-center gap-2">
                                {review.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => updateStatus(review.id, 'approved')}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                                        >
                                            <CheckCircleIcon className="w-4 h-4" />
                                            Схвалити
                                        </button>
                                        <button
                                            onClick={() => updateStatus(review.id, 'rejected')}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                                        >
                                            <XCircleIcon className="w-4 h-4" />
                                            Відхилити
                                        </button>
                                    </>
                                )}
                                {!review.reply && review.status === 'approved' && (
                                    <button
                                        onClick={() => {
                                            setSelectedReview(review);
                                            setShowReplyModal(true);
                                        }}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-100 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-200 transition-colors"
                                    >
                                        <ChatBubbleLeftIcon className="w-4 h-4" />
                                        Відповісти
                                    </button>
                                )}
                                <button
                                    onClick={() => deleteReview(review.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Reply Modal */}
            {showReplyModal && selectedReview && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setShowReplyModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Відповісти на відгук</h3>
                            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm font-medium text-gray-900">{selectedReview.customerName}</p>
                                <p className="text-sm text-gray-600 mt-1">{selectedReview.text}</p>
                            </div>
                            <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                placeholder="Введіть вашу відповідь..."
                            />
                            <div className="flex gap-3 mt-4">
                                <button
                                    onClick={() => setShowReplyModal(false)}
                                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Скасувати
                                </button>
                                <button
                                    onClick={handleReply}
                                    className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                                >
                                    Відправити
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
