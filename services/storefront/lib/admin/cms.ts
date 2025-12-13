// Content Management System (CMS)

export interface CMSPage {
    id: string;
    slug: string;
    title: string;
    content: CMSBlock[];
    meta: PageMeta;
    status: 'draft' | 'published' | 'archived';
    template: 'default' | 'landing' | 'blog' | 'product' | 'category';
    createdAt: string;
    updatedAt: string;
    publishedAt?: string;
    author: string;
    version: number;
    revisions: PageRevision[];
}

export interface PageMeta {
    title: string;
    description: string;
    keywords: string[];
    ogImage?: string;
    canonical?: string;
    noIndex?: boolean;
}

export interface PageRevision {
    id: string;
    version: number;
    content: CMSBlock[];
    createdAt: string;
    author: string;
    comment?: string;
}

export interface CMSBlock {
    id: string;
    type: BlockType;
    content: BlockContent;
    settings: BlockSettings;
    order: number;
}

export type BlockType =
    | 'hero'
    | 'text'
    | 'image'
    | 'gallery'
    | 'video'
    | 'products'
    | 'categories'
    | 'banner'
    | 'cta'
    | 'testimonials'
    | 'faq'
    | 'form'
    | 'html'
    | 'spacer'
    | 'divider'
    | 'columns'
    | 'tabs'
    | 'accordion';

export interface BlockContent {
    // Common fields
    title?: string;
    subtitle?: string;
    text?: string;
    html?: string;

    // Image/Media
    image?: MediaItem;
    images?: MediaItem[];
    video?: VideoItem;

    // Links
    link?: LinkItem;
    links?: LinkItem[];

    // Products/Categories
    productIds?: string[];
    categoryIds?: string[];
    productQuery?: ProductQuery;

    // Layout
    columns?: CMSBlock[][];
    tabs?: TabItem[];
    items?: AccordionItem[];

    // FAQ
    questions?: FAQItem[];

    // Testimonials
    testimonials?: Testimonial[];

    // Form
    formId?: string;
    fields?: FormField[];

    // Banner
    backgroundColor?: string;
    textColor?: string;
    countdown?: string;
}

export interface BlockSettings {
    padding?: string;
    margin?: string;
    backgroundColor?: string;
    textAlign?: 'left' | 'center' | 'right';
    fullWidth?: boolean;
    animation?: string;
    visibility?: 'all' | 'desktop' | 'mobile';
    customClass?: string;
    customId?: string;
}

export interface MediaItem {
    id: string;
    url: string;
    alt: string;
    width?: number;
    height?: number;
    caption?: string;
}

export interface VideoItem {
    type: 'youtube' | 'vimeo' | 'upload';
    url: string;
    thumbnail?: string;
    autoplay?: boolean;
}

export interface LinkItem {
    text: string;
    url: string;
    target?: '_blank' | '_self';
    style?: 'button' | 'link' | 'outline';
}

export interface ProductQuery {
    category?: string;
    tag?: string;
    sort?: 'newest' | 'popular' | 'price_asc' | 'price_desc';
    limit?: number;
    onSale?: boolean;
    featured?: boolean;
}

export interface TabItem {
    id: string;
    title: string;
    content: CMSBlock[];
}

export interface AccordionItem {
    id: string;
    title: string;
    content: string;
    isOpen?: boolean;
}

export interface FAQItem {
    question: string;
    answer: string;
}

export interface Testimonial {
    id: string;
    author: string;
    role?: string;
    avatar?: string;
    content: string;
    rating?: number;
}

export interface FormField {
    id: string;
    type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox' | 'radio';
    label: string;
    placeholder?: string;
    required?: boolean;
    options?: { value: string; label: string }[];
}

export interface CMSBanner {
    id: string;
    name: string;
    placement: 'homepage_hero' | 'homepage_secondary' | 'category_top' | 'product_sidebar' | 'checkout' | 'popup';
    content: CMSBlock;
    startDate?: string;
    endDate?: string;
    status: 'active' | 'inactive' | 'scheduled';
    priority: number;
    targetAudience?: {
        devices?: ('desktop' | 'mobile' | 'tablet')[];
        userTypes?: ('new' | 'returning' | 'vip')[];
        categories?: string[];
    };
    impressions: number;
    clicks: number;
    createdAt: string;
    updatedAt: string;
}

export interface CMSMenu {
    id: string;
    name: string;
    location: 'header' | 'footer' | 'mobile' | 'sidebar';
    items: MenuItem[];
    createdAt: string;
    updatedAt: string;
}

export interface MenuItem {
    id: string;
    title: string;
    url: string;
    target?: '_blank' | '_self';
    icon?: string;
    children?: MenuItem[];
    highlight?: boolean;
    badge?: string;
}

// CMS Service
class CMSService {
    private pages: Map<string, CMSPage> = new Map();
    private banners: Map<string, CMSBanner> = new Map();
    private menus: Map<string, CMSMenu> = new Map();

    // Pages
    async getPage(slugOrId: string): Promise<CMSPage | null> {
        // Check by ID first
        if (this.pages.has(slugOrId)) {
            return this.pages.get(slugOrId)!;
        }

        // Check by slug
        const page = Array.from(this.pages.values()).find((p) => p.slug === slugOrId);
        if (page) return page;

        // Fetch from API
        try {
            const response = await fetch(`/api/cms/pages/${slugOrId}`);
            if (response.ok) {
                const data = await response.json();
                this.pages.set(data.id, data);
                return data;
            }
        } catch {
            // Ignore errors
        }

        return null;
    }

    async getAllPages(status?: CMSPage['status']): Promise<CMSPage[]> {
        try {
            const url = status ? `/api/cms/pages?status=${status}` : '/api/cms/pages';
            const response = await fetch(url);
            if (response.ok) {
                return await response.json();
            }
        } catch {
            // Return cached
        }

        const pages = Array.from(this.pages.values());
        return status ? pages.filter((p) => p.status === status) : pages;
    }

    async createPage(page: Omit<CMSPage, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'revisions'>): Promise<CMSPage> {
        const newPage: CMSPage = {
            ...page,
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1,
            revisions: [],
        };

        this.pages.set(newPage.id, newPage);

        // Sync with server
        await this.savePage(newPage);

        return newPage;
    }

    async updatePage(pageId: string, updates: Partial<CMSPage>): Promise<CMSPage | null> {
        const page = this.pages.get(pageId);
        if (!page) return null;

        // Create revision
        const revision: PageRevision = {
            id: Date.now().toString(),
            version: page.version,
            content: page.content,
            createdAt: new Date().toISOString(),
            author: updates.author || page.author,
        };

        const updatedPage: CMSPage = {
            ...page,
            ...updates,
            updatedAt: new Date().toISOString(),
            version: page.version + 1,
            revisions: [...page.revisions, revision].slice(-10), // Keep last 10 revisions
        };

        this.pages.set(pageId, updatedPage);
        await this.savePage(updatedPage);

        return updatedPage;
    }

    async publishPage(pageId: string): Promise<CMSPage | null> {
        return this.updatePage(pageId, {
            status: 'published',
            publishedAt: new Date().toISOString(),
        });
    }

    async unpublishPage(pageId: string): Promise<CMSPage | null> {
        return this.updatePage(pageId, {
            status: 'draft',
            publishedAt: undefined,
        });
    }

    async deletePage(pageId: string): Promise<boolean> {
        const deleted = this.pages.delete(pageId);
        if (deleted) {
            await fetch(`/api/cms/pages/${pageId}`, { method: 'DELETE' }).catch(() => {});
        }
        return deleted;
    }

    async restoreRevision(pageId: string, revisionId: string): Promise<CMSPage | null> {
        const page = this.pages.get(pageId);
        if (!page) return null;

        const revision = page.revisions.find((r) => r.id === revisionId);
        if (!revision) return null;

        return this.updatePage(pageId, { content: revision.content });
    }

    // Banners
    async getBanners(placement?: CMSBanner['placement']): Promise<CMSBanner[]> {
        try {
            const url = placement ? `/api/cms/banners?placement=${placement}` : '/api/cms/banners';
            const response = await fetch(url);
            if (response.ok) {
                return await response.json();
            }
        } catch {
            // Return cached
        }

        const banners = Array.from(this.banners.values());
        return placement ? banners.filter((b) => b.placement === placement) : banners;
    }

    async getActiveBanner(placement: CMSBanner['placement']): Promise<CMSBanner | null> {
        const banners = await this.getBanners(placement);
        const now = new Date();

        return banners
            .filter((b) => {
                if (b.status !== 'active') return false;
                if (b.startDate && new Date(b.startDate) > now) return false;
                if (b.endDate && new Date(b.endDate) < now) return false;
                return true;
            })
            .sort((a, b) => b.priority - a.priority)[0] || null;
    }

    async createBanner(banner: Omit<CMSBanner, 'id' | 'createdAt' | 'updatedAt' | 'impressions' | 'clicks'>): Promise<CMSBanner> {
        const newBanner: CMSBanner = {
            ...banner,
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            impressions: 0,
            clicks: 0,
        };

        this.banners.set(newBanner.id, newBanner);
        await this.saveBanner(newBanner);

        return newBanner;
    }

    async updateBanner(bannerId: string, updates: Partial<CMSBanner>): Promise<CMSBanner | null> {
        const banner = this.banners.get(bannerId);
        if (!banner) return null;

        const updatedBanner = { ...banner, ...updates, updatedAt: new Date().toISOString() };
        this.banners.set(bannerId, updatedBanner);
        await this.saveBanner(updatedBanner);

        return updatedBanner;
    }

    async trackBannerImpression(bannerId: string): Promise<void> {
        const banner = this.banners.get(bannerId);
        if (banner) {
            banner.impressions++;
            this.banners.set(bannerId, banner);
        }
        await fetch(`/api/cms/banners/${bannerId}/impression`, { method: 'POST' }).catch(() => {});
    }

    async trackBannerClick(bannerId: string): Promise<void> {
        const banner = this.banners.get(bannerId);
        if (banner) {
            banner.clicks++;
            this.banners.set(bannerId, banner);
        }
        await fetch(`/api/cms/banners/${bannerId}/click`, { method: 'POST' }).catch(() => {});
    }

    // Menus
    async getMenu(location: CMSMenu['location']): Promise<CMSMenu | null> {
        const menu = Array.from(this.menus.values()).find((m) => m.location === location);
        if (menu) return menu;

        try {
            const response = await fetch(`/api/cms/menus/${location}`);
            if (response.ok) {
                const data = await response.json();
                this.menus.set(data.id, data);
                return data;
            }
        } catch {
            // Ignore errors
        }

        return null;
    }

    async updateMenu(menuId: string, items: MenuItem[]): Promise<CMSMenu | null> {
        const menu = this.menus.get(menuId);
        if (!menu) return null;

        const updatedMenu = { ...menu, items, updatedAt: new Date().toISOString() };
        this.menus.set(menuId, updatedMenu);

        await fetch(`/api/cms/menus/${menuId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedMenu),
        }).catch(() => {});

        return updatedMenu;
    }

    // Block templates
    getBlockTemplates(): { type: BlockType; name: string; icon: string; defaultContent: Partial<BlockContent> }[] {
        return [
            { type: 'hero', name: 'Hero банер', icon: 'photo', defaultContent: { title: 'Заголовок', subtitle: 'Підзаголовок' } },
            { type: 'text', name: 'Текст', icon: 'text', defaultContent: { text: '' } },
            { type: 'image', name: 'Зображення', icon: 'image', defaultContent: {} },
            { type: 'gallery', name: 'Галерея', icon: 'images', defaultContent: { images: [] } },
            { type: 'video', name: 'Відео', icon: 'video', defaultContent: {} },
            { type: 'products', name: 'Товари', icon: 'shopping-bag', defaultContent: { productQuery: { limit: 8 } } },
            { type: 'categories', name: 'Категорії', icon: 'grid', defaultContent: { categoryIds: [] } },
            { type: 'banner', name: 'Банер', icon: 'megaphone', defaultContent: {} },
            { type: 'cta', name: 'Заклик до дії', icon: 'cursor-click', defaultContent: { title: '', link: { text: 'Дізнатися більше', url: '/' } } },
            { type: 'testimonials', name: 'Відгуки', icon: 'chat', defaultContent: { testimonials: [] } },
            { type: 'faq', name: 'FAQ', icon: 'question-mark', defaultContent: { questions: [] } },
            { type: 'form', name: 'Форма', icon: 'clipboard', defaultContent: { fields: [] } },
            { type: 'html', name: 'HTML', icon: 'code', defaultContent: { html: '' } },
            { type: 'spacer', name: 'Відступ', icon: 'arrows-expand', defaultContent: {} },
            { type: 'divider', name: 'Роздільник', icon: 'minus', defaultContent: {} },
            { type: 'columns', name: 'Колонки', icon: 'view-columns', defaultContent: { columns: [[], []] } },
            { type: 'tabs', name: 'Вкладки', icon: 'folder', defaultContent: { tabs: [] } },
            { type: 'accordion', name: 'Акордеон', icon: 'chevron-down', defaultContent: { items: [] } },
        ];
    }

    // Private methods
    private async savePage(page: CMSPage): Promise<void> {
        try {
            await fetch('/api/cms/pages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(page),
            });
        } catch {
            // Ignore errors
        }
    }

    private async saveBanner(banner: CMSBanner): Promise<void> {
        try {
            await fetch('/api/cms/banners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(banner),
            });
        } catch {
            // Ignore errors
        }
    }
}

// Singleton instance
export const cms = new CMSService();

// React hook
export function useCMS() {
    return cms;
}
