import { prisma } from '../prisma';
import type { Prisma, User, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

export interface UserFilters {
    role?: UserRole;
    isVerified?: boolean;
    isActive?: boolean;
    search?: string;
}

class UserRepository {
    async findById(id: string) {
        return prisma.user.findUnique({
            where: { id },
            include: {
                addresses: true,
                loyaltyPoints: true,
            },
        });
    }

    async findByEmail(email: string) {
        return prisma.user.findUnique({
            where: { email },
        });
    }

    async findByPhone(phone: string) {
        return prisma.user.findUnique({
            where: { phone },
        });
    }

    async findMany(
        filters: UserFilters = {},
        page = 1,
        pageSize = 20
    ) {
        const where = this.buildWhereClause(filters);

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    phone: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    isVerified: true,
                    isActive: true,
                    createdAt: true,
                    lastLoginAt: true,
                    _count: {
                        select: { orders: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.user.count({ where }),
        ]);

        return {
            users,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    async create(data: {
        email: string;
        password?: string;
        firstName?: string;
        lastName?: string;
        phone?: string;
        role?: UserRole;
    }) {
        const passwordHash = data.password
            ? await bcrypt.hash(data.password, 12)
            : null;

        return prisma.user.create({
            data: {
                email: data.email,
                passwordHash,
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
                role: data.role || 'CUSTOMER',
            },
        });
    }

    async update(id: string, data: Prisma.UserUpdateInput) {
        return prisma.user.update({
            where: { id },
            data,
        });
    }

    async updatePassword(id: string, newPassword: string) {
        const passwordHash = await bcrypt.hash(newPassword, 12);
        return prisma.user.update({
            where: { id },
            data: { passwordHash },
        });
    }

    async verifyPassword(user: User, password: string): Promise<boolean> {
        if (!user.passwordHash) return false;
        return bcrypt.compare(password, user.passwordHash);
    }

    async updateLastLogin(id: string) {
        return prisma.user.update({
            where: { id },
            data: { lastLoginAt: new Date() },
        });
    }

    async setVerified(id: string) {
        return prisma.user.update({
            where: { id },
            data: { isVerified: true },
        });
    }

    async setActive(id: string, isActive: boolean) {
        return prisma.user.update({
            where: { id },
            data: { isActive },
        });
    }

    async setRole(id: string, role: UserRole) {
        return prisma.user.update({
            where: { id },
            data: { role },
        });
    }

    async delete(id: string) {
        return prisma.user.delete({
            where: { id },
        });
    }

    // Address management
    async addAddress(userId: string, data: Omit<Prisma.AddressCreateInput, 'user'>) {
        // If setting as default, unset other defaults first
        if (data.isDefault) {
            await prisma.address.updateMany({
                where: { userId, type: data.type },
                data: { isDefault: false },
            });
        }

        return prisma.address.create({
            data: {
                ...data,
                user: { connect: { id: userId } },
            },
        });
    }

    async updateAddress(addressId: string, data: Prisma.AddressUpdateInput) {
        const address = await prisma.address.findUnique({
            where: { id: addressId },
        });

        if (data.isDefault && address) {
            await prisma.address.updateMany({
                where: { userId: address.userId, type: address.type, id: { not: addressId } },
                data: { isDefault: false },
            });
        }

        return prisma.address.update({
            where: { id: addressId },
            data,
        });
    }

    async deleteAddress(addressId: string) {
        return prisma.address.delete({
            where: { id: addressId },
        });
    }

    async getAddresses(userId: string) {
        return prisma.address.findMany({
            where: { userId },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        });
    }

    // Stats
    async getUserStats(userId: string) {
        const [orders, wishlist, reviews, loyalty] = await Promise.all([
            prisma.order.aggregate({
                where: { userId, status: { in: ['COMPLETED', 'DELIVERED'] } },
                _count: { id: true },
                _sum: { total: true },
            }),
            prisma.wishlistItem.count({ where: { userId } }),
            prisma.review.count({ where: { userId } }),
            prisma.loyaltyPoints.findUnique({
                where: { userId },
            }),
        ]);

        return {
            ordersCount: orders._count.id,
            totalSpent: orders._sum.total || 0,
            wishlistCount: wishlist,
            reviewsCount: reviews,
            loyaltyPoints: loyalty?.balance || 0,
            loyaltyTier: loyalty?.tier || 'bronze',
        };
    }

    private buildWhereClause(filters: UserFilters): Prisma.UserWhereInput {
        const where: Prisma.UserWhereInput = {};

        if (filters.role) where.role = filters.role;
        if (filters.isVerified !== undefined) where.isVerified = filters.isVerified;
        if (filters.isActive !== undefined) where.isActive = filters.isActive;

        if (filters.search) {
            where.OR = [
                { email: { contains: filters.search, mode: 'insensitive' } },
                { phone: { contains: filters.search } },
                { firstName: { contains: filters.search, mode: 'insensitive' } },
                { lastName: { contains: filters.search, mode: 'insensitive' } },
            ];
        }

        return where;
    }
}

export const userRepository = new UserRepository();
