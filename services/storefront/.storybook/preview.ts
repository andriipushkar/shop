import type { Preview } from '@storybook/react';
import '../app/globals.css';

const preview: Preview = {
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
        nextjs: {
            appDirectory: true,
        },
        backgrounds: {
            default: 'light',
            values: [
                { name: 'light', value: '#ffffff' },
                { name: 'dark', value: '#1a1a1a' },
                { name: 'gray', value: '#f3f4f6' },
            ],
        },
        viewport: {
            viewports: {
                mobile: {
                    name: 'Mobile',
                    styles: { width: '375px', height: '667px' },
                },
                tablet: {
                    name: 'Tablet',
                    styles: { width: '768px', height: '1024px' },
                },
                desktop: {
                    name: 'Desktop',
                    styles: { width: '1440px', height: '900px' },
                },
            },
        },
        layout: 'centered',
    },
    globalTypes: {
        locale: {
            description: 'Internationalization locale',
            defaultValue: 'uk',
            toolbar: {
                icon: 'globe',
                items: [
                    { value: 'uk', title: 'Українська' },
                    { value: 'en', title: 'English' },
                ],
            },
        },
    },
};

export default preview;
