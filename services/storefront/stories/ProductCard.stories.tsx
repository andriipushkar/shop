import type { Meta, StoryObj } from '@storybook/react';
import ProductCard from '../components/ProductCard';

const mockProduct = {
    id: 'prod-1',
    name: 'iPhone 15 Pro Max 256GB',
    description: 'Найновіший флагман від Apple з A17 Pro чіпом',
    price: 54999,
    originalPrice: 59999,
    image_url: 'https://picsum.photos/400/400?random=1',
    category: 'Смартфони',
    categoryId: 'cat-1',
    sku: 'IPH15PM-256',
    stock: 15,
    rating: 4.8,
    reviews: 127,
    attributes: {
        brand: 'Apple',
        color: 'Titanium Black',
        storage: '256GB',
    },
    isNew: true,
    isBestseller: false,
};

const meta: Meta<typeof ProductCard> = {
    title: 'Components/ProductCard',
    component: ProductCard,
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: 'Картка товару для відображення в каталозі та на головній сторінці.',
            },
        },
    },
    tags: ['autodocs'],
    argTypes: {
        product: {
            description: 'Об\'єкт товару з усіма необхідними полями',
        },
        showQuickView: {
            description: 'Показувати кнопку швидкого перегляду',
            control: 'boolean',
        },
    },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
    args: {
        product: mockProduct,
        showQuickView: true,
    },
};

export const WithDiscount: Story = {
    args: {
        product: {
            ...mockProduct,
            price: 44999,
            originalPrice: 54999,
        },
        showQuickView: true,
    },
};

export const NewProduct: Story = {
    args: {
        product: {
            ...mockProduct,
            isNew: true,
            isBestseller: false,
        },
        showQuickView: true,
    },
};

export const Bestseller: Story = {
    args: {
        product: {
            ...mockProduct,
            isNew: false,
            isBestseller: true,
        },
        showQuickView: true,
    },
};

export const LowStock: Story = {
    args: {
        product: {
            ...mockProduct,
            stock: 3,
        },
        showQuickView: true,
    },
};

export const OutOfStock: Story = {
    args: {
        product: {
            ...mockProduct,
            stock: 0,
        },
        showQuickView: true,
    },
};

export const LongName: Story = {
    args: {
        product: {
            ...mockProduct,
            name: 'Samsung Galaxy S24 Ultra 512GB Titanium Black Special Edition з додатковими аксесуарами',
        },
        showQuickView: true,
    },
};

export const NoImage: Story = {
    args: {
        product: {
            ...mockProduct,
            image_url: '',
        },
        showQuickView: true,
    },
};

export const WithoutQuickView: Story = {
    args: {
        product: mockProduct,
        showQuickView: false,
    },
};

export const HighRating: Story = {
    args: {
        product: {
            ...mockProduct,
            rating: 5.0,
            reviews: 500,
        },
        showQuickView: true,
    },
};

export const NoReviews: Story = {
    args: {
        product: {
            ...mockProduct,
            rating: 0,
            reviews: 0,
        },
        showQuickView: true,
    },
};
