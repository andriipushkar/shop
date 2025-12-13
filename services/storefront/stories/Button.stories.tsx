import type { Meta, StoryObj } from '@storybook/react';
import { ShoppingCartIcon, HeartIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

// Простий компонент Button для демонстрації
interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    children: React.ReactNode;
    disabled?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
    iconPosition?: 'left' | 'right';
    fullWidth?: boolean;
    onClick?: () => void;
}

function Button({
    variant = 'primary',
    size = 'md',
    children,
    disabled = false,
    loading = false,
    icon,
    iconPosition = 'left',
    fullWidth = false,
    onClick,
}: ButtonProps) {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2';

    const variantClasses = {
        primary: 'bg-teal-600 text-white hover:bg-teal-700 focus:ring-teal-500',
        secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
        outline: 'border-2 border-teal-600 text-teal-600 hover:bg-teal-50 focus:ring-teal-500',
        ghost: 'text-teal-600 hover:bg-teal-50 focus:ring-teal-500',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    };

    const sizeClasses = {
        sm: 'px-3 py-1.5 text-sm gap-1.5',
        md: 'px-4 py-2 text-base gap-2',
        lg: 'px-6 py-3 text-lg gap-2.5',
    };

    const disabledClasses = 'opacity-50 cursor-not-allowed';
    const fullWidthClasses = fullWidth ? 'w-full' : '';

    return (
        <button
            className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabled || loading ? disabledClasses : ''} ${fullWidthClasses}`}
            disabled={disabled || loading}
            onClick={onClick}
        >
            {loading ? (
                <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Завантаження...</span>
                </>
            ) : (
                <>
                    {icon && iconPosition === 'left' && icon}
                    {children}
                    {icon && iconPosition === 'right' && icon}
                </>
            )}
        </button>
    );
}

const meta: Meta<typeof Button> = {
    title: 'UI/Button',
    component: Button,
    parameters: {
        layout: 'centered',
        docs: {
            description: {
                component: 'Універсальний компонент кнопки з підтримкою різних варіантів, розмірів та станів.',
            },
        },
    },
    tags: ['autodocs'],
    argTypes: {
        variant: {
            control: 'select',
            options: ['primary', 'secondary', 'outline', 'ghost', 'danger'],
            description: 'Візуальний стиль кнопки',
        },
        size: {
            control: 'select',
            options: ['sm', 'md', 'lg'],
            description: 'Розмір кнопки',
        },
        disabled: {
            control: 'boolean',
            description: 'Вимкнений стан',
        },
        loading: {
            control: 'boolean',
            description: 'Стан завантаження',
        },
        fullWidth: {
            control: 'boolean',
            description: 'На всю ширину контейнера',
        },
        iconPosition: {
            control: 'select',
            options: ['left', 'right'],
            description: 'Позиція іконки',
        },
    },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
    args: {
        children: 'Купити зараз',
        variant: 'primary',
        size: 'md',
    },
};

export const Secondary: Story = {
    args: {
        children: 'Детальніше',
        variant: 'secondary',
        size: 'md',
    },
};

export const Outline: Story = {
    args: {
        children: 'Скасувати',
        variant: 'outline',
        size: 'md',
    },
};

export const Ghost: Story = {
    args: {
        children: 'Пропустити',
        variant: 'ghost',
        size: 'md',
    },
};

export const Danger: Story = {
    args: {
        children: 'Видалити',
        variant: 'danger',
        size: 'md',
    },
};

export const Small: Story = {
    args: {
        children: 'Маленька',
        size: 'sm',
    },
};

export const Large: Story = {
    args: {
        children: 'Велика кнопка',
        size: 'lg',
    },
};

export const WithIconLeft: Story = {
    args: {
        children: 'До кошика',
        icon: <ShoppingCartIcon className="w-5 h-5" />,
        iconPosition: 'left',
    },
};

export const WithIconRight: Story = {
    args: {
        children: 'Продовжити',
        icon: <ArrowRightIcon className="w-5 h-5" />,
        iconPosition: 'right',
    },
};

export const IconOnly: Story = {
    args: {
        children: '',
        icon: <HeartIcon className="w-5 h-5" />,
        variant: 'outline',
    },
};

export const Disabled: Story = {
    args: {
        children: 'Недоступно',
        disabled: true,
    },
};

export const Loading: Story = {
    args: {
        children: 'Обробка',
        loading: true,
    },
};

export const FullWidth: Story = {
    args: {
        children: 'Оформити замовлення',
        fullWidth: true,
    },
    parameters: {
        layout: 'padded',
    },
    decorators: [
        (Story) => (
            <div style={{ width: '400px' }}>
                <Story />
            </div>
        ),
    ],
};

export const AllVariants: Story = {
    render: () => (
        <div className="flex flex-col gap-4">
            <div className="flex gap-4 items-center">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
            </div>
            <div className="flex gap-4 items-center">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
            </div>
        </div>
    ),
};
