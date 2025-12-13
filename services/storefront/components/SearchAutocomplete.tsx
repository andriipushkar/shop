'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  ClockIcon,
  FireIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import { useDebounce } from '@/lib/hooks';
import { logger } from '@/lib/logger';

export interface SearchSuggestion {
  id: string;
  type: 'product' | 'category' | 'brand' | 'query';
  text: string;
  url?: string;
  image?: string;
  price?: number;
  oldPrice?: number;
  rating?: number;
  highlight?: string;
}

export interface SearchAutocompleteProps {
  placeholder?: string;
  className?: string;
  onSearch?: (query: string) => void;
  maxSuggestions?: number;
  showTrending?: boolean;
  showRecent?: boolean;
}

const RECENT_SEARCHES_KEY = 'techshop_recent_searches';
const MAX_RECENT_SEARCHES = 5;

/**
 * Advanced Search Autocomplete Component
 * Features: fuzzy matching, suggestions, recent searches, trending
 */
export default function SearchAutocomplete({
  placeholder = 'Пошук товарів...',
  className = '',
  onSearch,
  maxSuggestions = 8,
  showTrending = true,
  showRecent = true,
}: SearchAutocompleteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const debouncedQuery = useDebounce(query, 300);

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        try {
          setRecentSearches(JSON.parse(stored));
        } catch {
          setRecentSearches([]);
        }
      }
    }
  }, []);

  // Fetch suggestions when query changes
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(debouncedQuery)}&limit=${maxSuggestions}`
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        }
      } catch (error) {
        logger.error('Search suggestions error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery, maxSuggestions]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save search to recent
  const saveToRecent = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;

    const updated = [
      searchQuery,
      ...recentSearches.filter(s => s !== searchQuery),
    ].slice(0, MAX_RECENT_SEARCHES);

    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  }, [recentSearches]);

  // Handle search submission
  const handleSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;

    saveToRecent(searchQuery);
    setIsOpen(false);

    if (onSearch) {
      onSearch(searchQuery);
    } else {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  }, [onSearch, router, saveToRecent]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const items = suggestions.length > 0 ? suggestions : [];
    const totalItems = items.length + (showRecent ? recentSearches.length : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : totalItems - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          if (selectedIndex < suggestions.length) {
            const suggestion = suggestions[selectedIndex];
            if (suggestion.url) {
              router.push(suggestion.url);
            } else {
              handleSearch(suggestion.text);
            }
          } else {
            const recentIndex = selectedIndex - suggestions.length;
            handleSearch(recentSearches[recentIndex]);
          }
        } else {
          handleSearch(query);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  // Remove single recent search
  const removeRecentSearch = (searchToRemove: string) => {
    const updated = recentSearches.filter(s => s !== searchToRemove);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  const showDropdown = isOpen && (query.length >= 2 || (showRecent && recentSearches.length > 0));

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
            aria-label="Очистити пошук"
          >
            <XMarkIcon className="w-4 h-4 text-gray-400" />
          </button>
        )}
        {isLoading && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="py-2">
              <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase">
                Результати пошуку
              </div>
              {suggestions.map((suggestion, index) => (
                <SuggestionItem
                  key={suggestion.id}
                  suggestion={suggestion}
                  isSelected={selectedIndex === index}
                  onClick={() => {
                    if (suggestion.url) {
                      router.push(suggestion.url);
                    } else {
                      handleSearch(suggestion.text);
                    }
                    setIsOpen(false);
                  }}
                />
              ))}
            </div>
          )}

          {/* No results */}
          {query.length >= 2 && suggestions.length === 0 && !isLoading && (
            <div className="p-4 text-center text-gray-500">
              <p>Нічого не знайдено за запитом "{query}"</p>
              <p className="text-sm mt-1">Спробуйте інші ключові слова</p>
            </div>
          )}

          {/* Recent Searches */}
          {showRecent && recentSearches.length > 0 && query.length < 2 && (
            <div className="py-2 border-t border-gray-100">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                  <ClockIcon className="w-3.5 h-3.5" />
                  Недавні пошуки
                </span>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-gray-400 hover:text-gray-600"
                  aria-label="Очистити історію пошуку"
                >
                  Очистити
                </button>
              </div>
              {recentSearches.map((search, index) => (
                <div
                  key={search}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                    selectedIndex === suggestions.length + index
                      ? 'bg-gray-100'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    setQuery(search);
                    handleSearch(search);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <ClockIcon className="w-4 h-4 text-gray-400" />
                    <span>{search}</span>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      removeRecentSearch(search);
                    }}
                    className="p-1 hover:bg-gray-200 rounded"
                    aria-label={`Видалити "${search}" з історії`}
                  >
                    <XMarkIcon className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Trending Searches */}
          {showTrending && query.length < 2 && (
            <TrendingSearches
              onClick={search => {
                setQuery(search);
                handleSearch(search);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Individual suggestion item
 */
function SuggestionItem({
  suggestion,
  isSelected,
  onClick,
}: {
  suggestion: SearchSuggestion;
  isSelected: boolean;
  onClick: () => void;
}) {
  const icons: Record<string, React.ReactNode> = {
    product: null,
    category: <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Категорія</span>,
    brand: <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Бренд</span>,
    query: <MagnifyingGlassIcon className="w-4 h-4 text-gray-400" />,
  };

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
        isSelected ? 'bg-gray-100' : 'hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      {suggestion.type === 'product' && suggestion.image ? (
        <div className="w-10 h-10 relative rounded overflow-hidden bg-gray-100 flex-shrink-0">
          <Image
            src={suggestion.image}
            alt={suggestion.text}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="w-10 h-10 flex items-center justify-center">
          {icons[suggestion.type]}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          <HighlightText text={suggestion.text} highlight={suggestion.highlight} />
        </p>
        {suggestion.type === 'product' && suggestion.price && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-teal-600">
              {suggestion.price.toLocaleString('uk-UA')} ₴
            </span>
            {suggestion.oldPrice && (
              <span className="text-xs text-gray-400 line-through">
                {suggestion.oldPrice.toLocaleString('uk-UA')} ₴
              </span>
            )}
          </div>
        )}
      </div>

      {suggestion.rating && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span className="text-yellow-500">★</span>
          {suggestion.rating}
        </div>
      )}
    </div>
  );
}

/**
 * Safe text highlighting component (prevents XSS)
 * Parses highlight markers and renders safely without dangerouslySetInnerHTML
 */
function HighlightText({ text, highlight }: { text: string; highlight?: string }) {
  if (!highlight) {
    return <>{text}</>;
  }

  // Parse highlight string to extract marked portions
  // Expected format: "text with <mark>highlighted</mark> parts"
  const parts: { text: string; isHighlighted: boolean }[] = [];
  const regex = /<mark>(.*?)<\/mark>/gi;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(highlight)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({
        text: highlight.slice(lastIndex, match.index),
        isHighlighted: false,
      });
    }
    // Add the highlighted text
    parts.push({
      text: match[1],
      isHighlighted: true,
    });
    lastIndex = regex.lastIndex;
  }

  // Add remaining text after last match
  if (lastIndex < highlight.length) {
    parts.push({
      text: highlight.slice(lastIndex),
      isHighlighted: false,
    });
  }

  // If no highlights were found, just return the original text
  if (parts.length === 0) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, index) =>
        part.isHighlighted ? (
          <mark key={index} className="bg-yellow-200 rounded px-0.5">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  );
}

/**
 * Trending searches section
 */
function TrendingSearches({ onClick }: { onClick: (search: string) => void }) {
  // Mock trending searches - in production, fetch from API
  const trendingSearches = [
    'iPhone 15',
    'MacBook Air',
    'AirPods Pro',
    'Samsung Galaxy',
    'PlayStation 5',
  ];

  return (
    <div className="py-2 border-t border-gray-100">
      <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
        <ArrowTrendingUpIcon className="w-3.5 h-3.5" />
        Популярні запити
      </div>
      <div className="px-3 py-2 flex flex-wrap gap-2">
        {trendingSearches.map(search => (
          <button
            key={search}
            onClick={() => onClick(search)}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
          >
            <FireIcon className="w-3.5 h-3.5 text-orange-500" />
            {search}
          </button>
        ))}
      </div>
    </div>
  );
}
