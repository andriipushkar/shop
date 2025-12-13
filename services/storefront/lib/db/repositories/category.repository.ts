import { prisma } from '../prisma';
import type { Prisma, Category } from '@prisma/client';

export interface CategoryWithChildren extends Category {
    children?: CategoryWithChildren[];
    _count?: { products: number };
}

class CategoryRepository {
    async findById(id: string) {
        return prisma.category.findUnique({
            where: { id },
            include: {
                parent: true,
                children: { where: { isActive: true }, orderBy: { order: 'asc' } },
                _count: { select: { products: true } },
            },
        });
    }

    async findBySlug(slug: string) {
        return prisma.category.findUnique({
            where: { slug },
            include: {
                parent: true,
                children: { where: { isActive: true }, orderBy: { order: 'asc' } },
                _count: { select: { products: true } },
            },
        });
    }

    async findAll(includeInactive = false) {
        return prisma.category.findMany({
            where: includeInactive ? {} : { isActive: true },
            include: {
                _count: { select: { products: true } },
            },
            orderBy: [{ order: 'asc' }, { name: 'asc' }],
        });
    }

    async findRootCategories() {
        return prisma.category.findMany({
            where: {
                parentId: null,
                isActive: true,
            },
            include: {
                children: {
                    where: { isActive: true },
                    orderBy: { order: 'asc' },
                    include: {
                        children: {
                            where: { isActive: true },
                            orderBy: { order: 'asc' },
                        },
                    },
                },
                _count: { select: { products: true } },
            },
            orderBy: { order: 'asc' },
        });
    }

    async getTree(): Promise<CategoryWithChildren[]> {
        const categories = await prisma.category.findMany({
            where: { isActive: true },
            include: {
                _count: { select: { products: true } },
            },
            orderBy: { order: 'asc' },
        });

        return this.buildTree(categories);
    }

    async create(data: Prisma.CategoryCreateInput) {
        return prisma.category.create({
            data,
        });
    }

    async update(id: string, data: Prisma.CategoryUpdateInput) {
        return prisma.category.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        // First update children to have no parent
        await prisma.category.updateMany({
            where: { parentId: id },
            data: { parentId: null },
        });

        return prisma.category.delete({
            where: { id },
        });
    }

    async reorder(categories: { id: string; order: number }[]) {
        const updates = categories.map((cat) =>
            prisma.category.update({
                where: { id: cat.id },
                data: { order: cat.order },
            })
        );

        return prisma.$transaction(updates);
    }

    async getBreadcrumb(categoryId: string): Promise<Category[]> {
        const breadcrumb: Category[] = [];
        let currentId: string | null = categoryId;

        while (currentId) {
            const found: Category | null = await prisma.category.findUnique({
                where: { id: currentId },
            });

            if (found) {
                breadcrumb.unshift(found);
                currentId = found.parentId;
            } else {
                break;
            }
        }

        return breadcrumb;
    }

    async getCategoryPath(categoryId: string): Promise<string[]> {
        const breadcrumb = await this.getBreadcrumb(categoryId);
        return breadcrumb.map((c) => c.slug);
    }

    async getChildrenIds(categoryId: string): Promise<string[]> {
        const children = await prisma.category.findMany({
            where: { parentId: categoryId },
            select: { id: true },
        });

        const ids = [categoryId];
        for (const child of children) {
            const childIds = await this.getChildrenIds(child.id);
            ids.push(...childIds);
        }

        return ids;
    }

    private buildTree(
        categories: (Category & { _count?: { products: number } })[],
        parentId: string | null = null
    ): CategoryWithChildren[] {
        return categories
            .filter((c) => c.parentId === parentId)
            .map((category) => ({
                ...category,
                children: this.buildTree(categories, category.id),
            }));
    }
}

export const categoryRepository = new CategoryRepository();
