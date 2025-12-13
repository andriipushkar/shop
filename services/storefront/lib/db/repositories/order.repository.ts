import { prisma } from '../prisma';
import type { Prisma, Order, OrderStatus, PaymentStatus, ShippingStatus } from '@prisma/client';

export interface OrderFilters {
    userId?: string;
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    shippingStatus?: ShippingStatus;
    marketplace?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
}

export interface OrderListResult {
    orders: Order[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

class OrderRepository {
    async findById(id: string) {
        return prisma.order.findUnique({
            where: { id },
            include: {
                user: true,
                address: true,
                items: {
                    include: {
                        product: { include: { images: { where: { isMain: true }, take: 1 } } },
                        variant: true,
                    },
                },
                payments: true,
                history: { orderBy: { createdAt: 'desc' } },
            },
        });
    }

    async findByOrderNumber(orderNumber: string) {
        return prisma.order.findUnique({
            where: { orderNumber },
            include: {
                items: { include: { product: true } },
                payments: true,
            },
        });
    }

    async findMany(
        filters: OrderFilters = {},
        page = 1,
        pageSize = 20,
        orderBy: Prisma.OrderOrderByWithRelationInput = { createdAt: 'desc' }
    ): Promise<OrderListResult> {
        const where = this.buildWhereClause(filters);

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    user: { select: { id: true, email: true, firstName: true, lastName: true } },
                    items: { include: { product: { select: { id: true, name: true } } } },
                },
                orderBy,
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.order.count({ where }),
        ]);

        return {
            orders,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    async create(data: Prisma.OrderCreateInput) {
        const order = await prisma.order.create({
            data: {
                ...data,
                orderNumber: await this.generateOrderNumber(),
            },
            include: {
                items: true,
            },
        });

        // Create initial history entry
        await prisma.orderHistory.create({
            data: {
                orderId: order.id,
                status: order.status,
                comment: 'Замовлення створено',
            },
        });

        return order;
    }

    async updateStatus(
        id: string,
        status: OrderStatus,
        comment?: string,
        createdBy?: string
    ) {
        const order = await prisma.order.update({
            where: { id },
            data: { status },
        });

        await prisma.orderHistory.create({
            data: {
                orderId: id,
                status,
                comment,
                createdBy,
            },
        });

        return order;
    }

    async updatePaymentStatus(id: string, paymentStatus: PaymentStatus) {
        return prisma.order.update({
            where: { id },
            data: { paymentStatus },
        });
    }

    async updateShippingStatus(
        id: string,
        shippingStatus: ShippingStatus,
        trackingNumber?: string
    ) {
        return prisma.order.update({
            where: { id },
            data: {
                shippingStatus,
                ...(trackingNumber && { trackingNumber }),
            },
        });
    }

    async addAdminNote(id: string, note: string) {
        const order = await prisma.order.findUnique({
            where: { id },
            select: { adminNotes: true },
        });

        const timestamp = new Date().toISOString();
        const existingNotes = order?.adminNotes || '';
        const newNotes = existingNotes
            ? `${existingNotes}\n\n[${timestamp}] ${note}`
            : `[${timestamp}] ${note}`;

        return prisma.order.update({
            where: { id },
            data: { adminNotes: newNotes },
        });
    }

    async getUserOrders(userId: string, page = 1, pageSize = 10) {
        return this.findMany({ userId }, page, pageSize);
    }

    async getRecentOrders(limit = 10) {
        return prisma.order.findMany({
            include: {
                user: { select: { firstName: true, lastName: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    async getOrderStats(dateFrom?: Date, dateTo?: Date) {
        const where: Prisma.OrderWhereInput = {};
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom) where.createdAt.gte = dateFrom;
            if (dateTo) where.createdAt.lte = dateTo;
        }

        const [total, byStatus, revenue] = await Promise.all([
            prisma.order.count({ where }),
            prisma.order.groupBy({
                by: ['status'],
                where,
                _count: { id: true },
            }),
            prisma.order.aggregate({
                where: {
                    ...where,
                    status: { in: ['COMPLETED', 'DELIVERED'] },
                },
                _sum: { total: true },
            }),
        ]);

        return {
            total,
            byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count.id])),
            revenue: revenue._sum.total || 0,
        };
    }

    private async generateOrderNumber(): Promise<string> {
        const date = new Date();
        const prefix = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;

        const lastOrder = await prisma.order.findFirst({
            where: {
                orderNumber: { startsWith: prefix },
            },
            orderBy: { orderNumber: 'desc' },
        });

        const sequence = lastOrder
            ? parseInt(lastOrder.orderNumber.slice(-5)) + 1
            : 1;

        return `${prefix}${String(sequence).padStart(5, '0')}`;
    }

    private buildWhereClause(filters: OrderFilters): Prisma.OrderWhereInput {
        const where: Prisma.OrderWhereInput = {};

        if (filters.userId) where.userId = filters.userId;
        if (filters.status) where.status = filters.status;
        if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;
        if (filters.shippingStatus) where.shippingStatus = filters.shippingStatus;
        if (filters.marketplace) where.marketplace = filters.marketplace;

        if (filters.dateFrom || filters.dateTo) {
            where.createdAt = {};
            if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
            if (filters.dateTo) where.createdAt.lte = filters.dateTo;
        }

        if (filters.search) {
            where.OR = [
                { orderNumber: { contains: filters.search, mode: 'insensitive' } },
                { customerEmail: { contains: filters.search, mode: 'insensitive' } },
                { customerPhone: { contains: filters.search } },
                { customerName: { contains: filters.search, mode: 'insensitive' } },
                { trackingNumber: { contains: filters.search, mode: 'insensitive' } },
            ];
        }

        return where;
    }
}

export const orderRepository = new OrderRepository();
