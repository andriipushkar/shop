'use client';

import { useState } from 'react';
import {
    ShareIcon,
    LinkIcon,
    CheckIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';

interface SocialShareProps {
    url: string;
    title: string;
    description?: string;
    image?: string;
    price?: number;
    compact?: boolean;
}

const socialPlatforms = [
    {
        name: 'Facebook',
        icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
        ),
        color: 'bg-blue-600 hover:bg-blue-700',
        getUrl: (url: string, title: string) =>
            `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(title)}`,
    },
    {
        name: 'Twitter',
        icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
        ),
        color: 'bg-black hover:bg-gray-800',
        getUrl: (url: string, title: string) =>
            `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    },
    {
        name: 'Telegram',
        icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
            </svg>
        ),
        color: 'bg-sky-500 hover:bg-sky-600',
        getUrl: (url: string, title: string) =>
            `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    },
    {
        name: 'Viber',
        icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.398.002C9.473.028 5.331.344 3.014 2.467 1.294 4.182.518 6.792.455 10.063c-.064 3.271-.149 9.403 5.746 11.085l.006.001v2.543s-.037.975.607 1.173c.778.24 1.235-.5 1.979-1.299.407-.437.97-1.078 1.395-1.57 3.848.322 6.81-.416 7.15-.525.784-.254 5.22-.822 5.942-6.704.745-6.058-.351-9.887-2.322-11.606l.002-.001c-.565-.543-2.865-2.119-7.618-2.145a23.738 23.738 0 0 0-1.944-.013zM11.5 1.675h.146c4.176.019 6.2 1.323 6.695 1.776 1.682 1.465 2.593 4.823 1.954 10.006-.612 4.995-4.266 5.375-4.922 5.588-.287.092-2.876.715-6.199.53 0 0-2.456 2.959-3.222 3.728-.12.121-.266.169-.362.148-.135-.03-.172-.18-.171-.398l.017-4.049c-5.014-1.429-4.725-6.635-4.671-9.382.054-2.747.678-4.96 2.134-6.41 1.968-1.803 5.473-2.063 7.18-2.083 0 0 .96-.031 1.421.046zm.477 2.726c-.131 0-.262.051-.362.152a.51.51 0 0 0 .003.72c.099.099.231.149.362.149.131 0 .262-.05.361-.149.2-.199.2-.52.003-.72a.507.507 0 0 0-.367-.152zm1.95.157a5.27 5.27 0 0 1 1.936.753c1.645 1.107 1.938 2.675 1.958 3.076a.506.506 0 0 1-.483.528.508.508 0 0 1-.528-.484c-.008-.168-.205-1.466-1.456-2.308-.631-.425-1.393-.645-2.274-.658a.508.508 0 0 1-.498-.517.508.508 0 0 1 .517-.499c.127.003.255.048.256.048l.572.061zm-3.127.899c-.266 0-.52.023-.753.074-.616.134-1.074.415-1.402.858-.361.487-.425 1.087-.291 1.661.203.867.972 1.784 2.111 2.51l.005.003c.383.262.716.558.992.872a4.17 4.17 0 0 1 .673 1.041c.175.39.323.79.438 1.199.09.32.177.673.18 1.051a1.56 1.56 0 0 1-.416 1.108c-.282.3-.675.497-1.146.576-.239.041-.469.028-.648-.004a1.845 1.845 0 0 1-.459-.156l-.065-.035a4.16 4.16 0 0 1-.388-.231c-.4-.275-.923-.752-1.576-1.515-.156-.182-.364-.257-.55-.223-.186.034-.356.166-.421.386l-.073.245c-.064.22-.233.385-.457.414a.68.68 0 0 1-.519-.153c-.252-.205-.456-.596-.456-1.325 0-.632.203-1.083.504-1.382.303-.301.702-.46 1.129-.491.427-.03.865.066 1.213.26.346.193.628.498.706.883a.509.509 0 0 1-.392.602.508.508 0 0 1-.603-.391c-.021-.104-.122-.236-.32-.347-.198-.11-.448-.168-.693-.15-.243.017-.459.1-.609.249-.149.148-.251.374-.251.767 0 .395.089.556.107.582.061-.022.154-.09.21-.281l.072-.245c.138-.466.522-.8.98-.876.458-.075.936.098 1.245.459.63.736 1.105 1.163 1.419 1.378.07.048.135.088.193.118.114.037.203.043.221.04.241-.041.387-.125.47-.213.082-.088.116-.2.116-.34-.002-.237-.066-.498-.145-.78a10.62 10.62 0 0 0-.396-1.082 5.044 5.044 0 0 0-.824-1.281 6.283 6.283 0 0 0-1.137-.996l-.007-.004c-1.001-.64-1.585-1.373-1.731-1.994-.073-.31-.027-.605.156-.852.181-.245.47-.404.875-.491.162-.035.344-.053.544-.053.448 0 .83.086 1.129.19a.51.51 0 0 1 .303.654.511.511 0 0 1-.653.303c-.216-.074-.483-.132-.779-.132zm5.02.456c.67.24 1.268.599 1.783 1.071.75.687 1.294 1.57 1.618 2.626.323 1.058.418 2.182.283 3.345a.508.508 0 0 1-1.003-.148c.117-.998.035-1.953-.238-2.846a4.997 4.997 0 0 0-1.317-2.144 4.204 4.204 0 0 0-1.458-.876.509.509 0 0 1-.296-.655.508.508 0 0 1 .628-.373zm-1.06 1.803c.465.152.902.391 1.3.713.577.465.993 1.075 1.238 1.815.246.74.315 1.502.206 2.269a.51.51 0 0 1-.576.432.508.508 0 0 1-.432-.575c.084-.59.027-1.183-.168-1.77-.196-.586-.51-1.077-.935-1.42a3.058 3.058 0 0 0-.989-.54.508.508 0 1 1 .356-.924z"/>
            </svg>
        ),
        color: 'bg-purple-600 hover:bg-purple-700',
        getUrl: (url: string, title: string) =>
            `viber://forward?text=${encodeURIComponent(title + ' ' + url)}`,
    },
    {
        name: 'WhatsApp',
        icon: (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
        ),
        color: 'bg-green-500 hover:bg-green-600',
        getUrl: (url: string, title: string) =>
            `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`,
    },
];

export default function SocialShare({ url, title, description, image, price, compact = false }: SocialShareProps) {
    const [showModal, setShowModal] = useState(false);
    const [copied, setCopied] = useState(false);

    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;
    const shareTitle = price ? `${title} - ${price} ₴` : title;

    const handleShare = (platform: typeof socialPlatforms[0]) => {
        const shareLink = platform.getUrl(shareUrl, shareTitle);
        window.open(shareLink, '_blank', 'width=600,height=400');
    };

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: shareTitle,
                    text: description,
                    url: shareUrl,
                });
            } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                    setShowModal(true);
                }
            }
        } else {
            setShowModal(true);
        }
    };

    if (compact) {
        return (
            <div className="flex items-center gap-2">
                {socialPlatforms.slice(0, 4).map((platform) => (
                    <button
                        key={platform.name}
                        onClick={() => handleShare(platform)}
                        className={`p-2 rounded-lg text-white transition-colors ${platform.color}`}
                        title={`Поділитись у ${platform.name}`}
                    >
                        {platform.icon}
                    </button>
                ))}
                <button
                    onClick={handleCopyLink}
                    className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
                    title="Копіювати посилання"
                >
                    {copied ? <CheckIcon className="w-5 h-5 text-green-600" /> : <LinkIcon className="w-5 h-5" />}
                </button>
            </div>
        );
    }

    return (
        <>
            <button
                onClick={handleNativeShare}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
                <ShareIcon className="w-5 h-5" />
                <span>Поділитись</span>
            </button>

            {/* Share Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4">
                        <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Поділитись</h3>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
                                >
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Preview */}
                            {image && (
                                <div className="mb-4 p-3 bg-gray-50 rounded-xl flex items-center gap-3">
                                    <img src={image} alt={title} className="w-16 h-16 object-cover rounded-lg" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 truncate">{title}</p>
                                        {price && <p className="text-teal-600 font-semibold">{price} ₴</p>}
                                    </div>
                                </div>
                            )}

                            {/* Social Buttons */}
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                {socialPlatforms.map((platform) => (
                                    <button
                                        key={platform.name}
                                        onClick={() => handleShare(platform)}
                                        className={`flex flex-col items-center gap-2 p-3 rounded-xl text-white transition-colors ${platform.color}`}
                                    >
                                        {platform.icon}
                                        <span className="text-xs">{platform.name}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Copy Link */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={shareUrl}
                                    readOnly
                                    className="flex-1 px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600"
                                />
                                <button
                                    onClick={handleCopyLink}
                                    className={`px-4 py-2.5 rounded-lg font-medium transition-colors ${
                                        copied
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-teal-600 text-white hover:bg-teal-700'
                                    }`}
                                >
                                    {copied ? (
                                        <span className="flex items-center gap-1">
                                            <CheckIcon className="w-4 h-4" />
                                            Скопійовано
                                        </span>
                                    ) : (
                                        'Копіювати'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
