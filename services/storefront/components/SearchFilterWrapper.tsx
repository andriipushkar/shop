'use client';

import { Category } from '@/lib/api';
import SearchFilter from './SearchFilter';

interface SearchFilterWrapperProps {
    categories: Category[];
}

export default function SearchFilterWrapper({ categories }: SearchFilterWrapperProps) {
    return <SearchFilter categories={categories} />;
}
