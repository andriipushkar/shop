import { prisma } from '../prisma';
import type { Prisma, Product, ProductStatus } from '@prisma/client';

export interface ProductFilters {
    categoryId?: string;
    brandId?: string;
    status?: ProductStatus;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
    isNew?: boolean;
    isBestseller?: boolean;
    isFeatured?: boolean;
}

export interface ProductListResult {
    products: Product[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

class ProductRepository {
    async findById(id: string) {
        return prisma.product.findUnique({
            where: { id },
            include: {
                category: true,
                brand: true,
                images: { orderBy: { order: 'asc' } },
                attributes: { include: { attribute: true } },
                variants: true,
                inventory: { include: { warehouse: true } },
            },
        });
    }

    async findBySlug(slug: string) {
        return prisma.product.findUnique({
            where: { slug },
            include: {
                category: true,
                brand: true,
                images: { orderBy: { order: 'asc' } },
                attributes: { include: { attribute: true } },
                variants: { where: { isActive: true } },
            },
        });
    }

    async findBySku(sku: string) {
        return prisma.product.findUnique({
            where: { sku },
        });
    }

    async findMany(
        filters: ProductFilters = {},
        page = 1,
        pageSize = 20,
        orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' }
    ): Promise<ProductListResult> {
        const where = this.buildWhereClause(filters);

        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                include: {
                    category: true,
                    brand: true,
                    images: { where: { isMain: true }, take: 1 },
                },
                orderBy,
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.product.count({ where }),
        ]);

        return {
            products,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    async create(data: Prisma.ProductCreateInput) {
        return prisma.product.create({
            data,
            include: {
                category: true,
                brand: true,
                images: true,
            },
        });
    }

    async update(id: string, data: Prisma.ProductUpdateInput) {
        return prisma.product.update({
            where: { id },
            data,
            include: {
                category: true,
                brand: true,
                images: true,
            },
        });
    }

    async delete(id: string) {
        return prisma.product.delete({
            where: { id },
        });
    }

    async updateStatus(id: string, status: ProductStatus) {
        return prisma.product.update({
            where: { id },
            data: { status },
        });
    }

    async incrementViewCount(id: string) {
        return prisma.product.update({
            where: { id },
            data: { viewCount: { increment: 1 } },
        });
    }

    async updateRating(id: string) {
        const result = await prisma.review.aggregate({
            where: { productId: id, isPublished: true },
            _avg: { rating: true },
            _count: { rating: true },
        });

        return prisma.product.update({
            where: { id },
            data: {
                rating: result._avg.rating || 0,
                reviewCount: result._count.rating,
            },
        });
    }

    async getRelatedProducts(productId: string, limit = 8) {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            select: { categoryId: true, brandId: true },
        });

        if (!product) return [];

        return prisma.product.findMany({
            where: {
                id: { not: productId },
                status: 'ACTIVE',
                OR: [
                    { categoryId: product.categoryId },
                    { brandId: product.brandId },
                ],
            },
            include: {
                images: { where: { isMain: true }, take: 1 },
            },
            take: limit,
            orderBy: { soldCount: 'desc' },
        });
    }

    async getBestsellers(limit = 10) {
        return prisma.product.findMany({
            where: {
                status: 'ACTIVE',
                isBestseller: true,
            },
            include: {
                images: { where: { isMain: true }, take: 1 },
            },
            take: limit,
            orderBy: { soldCount: 'desc' },
        });
    }

    async getNewArrivals(limit = 10) {
        return prisma.product.findMany({
            where: {
                status: 'ACTIVE',
                isNew: true,
            },
            include: {
                images: { where: { isMain: true }, take: 1 },
            },
            take: limit,
            orderBy: { createdAt: 'desc' },
        });
    }

    async getFeaturedProducts(limit = 10) {
        return prisma.product.findMany({
            where: {
                status: 'ACTIVE',
                isFeatured: true,
            },
            include: {
                images: { where: { isMain: true }, take: 1 },
            },
            take: limit,
        });
    }

    async getStockLevel(productId: string, warehouseId?: string) {
        const where: Prisma.InventoryWhereInput = { productId };
        if (warehouseId) where.warehouseId = warehouseId;

        const inventory = await prisma.inventory.findMany({
            where,
            include: { warehouse: true },
        });

        const total = inventory.reduce((sum, inv) => sum + inv.quantity - inv.reserved, 0);

        return { total, byWarehouse: inventory };
    }

    private buildWhereClause(filters: ProductFilters): Prisma.ProductWhereInput {
        const where: Prisma.ProductWhereInput = {};

        if (filters.categoryId) where.categoryId = filters.categoryId;
        if (filters.brandId) where.brandId = filters.brandId;
        if (filters.status) where.status = filters.status;
        if (filters.isNew !== undefined) where.isNew = filters.isNew;
        if (filters.isBestseller !== undefined) where.isBestseller = filters.isBestseller;
        if (filters.isFeatured !== undefined) where.isFeatured = filters.isFeatured;

        if (filters.minPrice || filters.maxPrice) {
            where.price = {};
            if (filters.minPrice) where.price.gte = filters.minPrice;
            if (filters.maxPrice) where.price.lte = filters.maxPrice;
        }

        if (filters.search) {
            where.OR = [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { nameUa: { contains: filters.search, mode: 'insensitive' } },
                { sku: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } },
            ];
        }

        return where;
    }
}

export const productRepository = new ProductRepository();
