import type { Meta, StoryObj } from '@storybook/react';
import Header from '../components/Header';

const meta: Meta<typeof Header> = {
    title: 'Components/Header',
    component: Header,
    parameters: {
        layout: 'fullscreen',
        docs: {
            description: {
                component: 'Головний хедер магазину з логотипом, пошуком, навігацією та кошиком.',
            },
        },
    },
    tags: ['autodocs'],
    decorators: [
        (Story) => (
            <div className="min-h-[200px]">
                <Story />
            </div>
        ),
    ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Mobile: Story = {
    parameters: {
        viewport: {
            defaultViewport: 'mobile',
        },
    },
};

export const Tablet: Story = {
    parameters: {
        viewport: {
            defaultViewport: 'tablet',
        },
    },
};
