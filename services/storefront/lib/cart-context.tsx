'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Product } from './api';

export interface CartItem {
    product: Product;
    quantity: number;
}

interface CartContextType {
    items: CartItem[];
    addToCart: (product: Product) => Promise<void>;
    removeFromCart: (productId: string) => Promise<void>;
    updateQuantity: (productId: string, quantity: number) => Promise<void>;
    clearCart: () => Promise<void>;
    refreshCart: () => Promise<void>;
    totalItems: number;
    totalPrice: number;
    userId: number;
    isLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [userId, setUserId] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    // Initialize userId with cryptographically secure ID
    useEffect(() => {
        let savedUserId = localStorage.getItem('userId');
        if (!savedUserId) {
            // Generate cryptographically secure user ID using Web Crypto API
            // Uses first 8 characters of UUID and converts to number for compatibility
            const uuid = crypto.randomUUID();
            const newUserId = parseInt(uuid.replace(/-/g, '').slice(0, 8), 16) + 1000000;
            localStorage.setItem('userId', String(newUserId));
            savedUserId = String(newUserId);
        }
        setUserId(Number(savedUserId));
        setIsInitialized(true);
    }, []);

    // Fetch cart from API when userId is set
    const refreshCart = useCallback(async () => {
        if (!userId) return;

        setIsLoading(true);
        try {
            const res = await fetch(`/api/cart/${userId}`);
            if (res.ok) {
                const apiItems = await res.json();
                // Convert API items to CartItem format
                const cartItems: CartItem[] = apiItems.map((item: {
                    product_id: string;
                    name: string;
                    price: number;
                    quantity: number;
                    image_url?: string;
                }) => ({
                    product: {
                        id: item.product_id,
                        name: item.name,
                        price: item.price,
                        sku: '',
                        stock: 0,
                        image_url: item.image_url,
                    },
                    quantity: item.quantity,
                }));
                setItems(cartItems);
            }
        } catch (error) {
            console.error('Error fetching cart:', error);
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    // Load cart when userId changes
    useEffect(() => {
        if (isInitialized && userId) {
            refreshCart();
        }
    }, [userId, isInitialized, refreshCart]);

    const addToCart = async (product: Product) => {
        if (!userId) return;

        // Optimistic update
        setItems(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });

        // Sync with API
        try {
            await fetch(`/api/cart/${userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ product_id: product.id, quantity: 1 }),
            });
        } catch (error) {
            console.error('Error adding to cart:', error);
            // Refresh cart to sync with server
            refreshCart();
        }
    };

    const removeFromCart = async (productId: string) => {
        if (!userId) return;

        // Optimistic update
        setItems(prev => prev.filter(item => item.product.id !== productId));

        // Sync with API
        try {
            await fetch(`/api/cart/${userId}/item/${productId}`, {
                method: 'DELETE',
            });
        } catch (error) {
            console.error('Error removing from cart:', error);
            refreshCart();
        }
    };

    const updateQuantity = async (productId: string, quantity: number) => {
        if (!userId) return;

        if (quantity <= 0) {
            await removeFromCart(productId);
            return;
        }

        // Optimistic update
        setItems(prev =>
            prev.map(item =>
                item.product.id === productId
                    ? { ...item, quantity }
                    : item
            )
        );

        // Sync with API
        try {
            await fetch(`/api/cart/${userId}/item/${productId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity }),
            });
        } catch (error) {
            console.error('Error updating quantity:', error);
            refreshCart();
        }
    };

    const clearCart = async () => {
        if (!userId) return;

        // Optimistic update
        setItems([]);

        // Sync with API
        try {
            await fetch(`/api/cart/${userId}`, {
                method: 'DELETE',
            });
        } catch (error) {
            console.error('Error clearing cart:', error);
            refreshCart();
        }
    };

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

    return (
        <CartContext.Provider value={{
            items,
            addToCart,
            removeFromCart,
            updateQuantity,
            clearCart,
            refreshCart,
            totalItems,
            totalPrice,
            userId,
            isLoading,
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
