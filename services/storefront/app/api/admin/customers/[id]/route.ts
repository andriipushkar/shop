import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { userRepository } from '@/lib/db/repositories/user.repository';
import type { UserRole } from '@prisma/client';
import { apiLogger } from '@/lib/logger';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/admin/customers/[id] - Get single customer with stats
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER', 'SUPPORT'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const user = await userRepository.findById(id);

        if (!user) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        // Get user stats
        const stats = await userRepository.getUserStats(id);

        // Remove sensitive data
        const { passwordHash, ...userWithoutPassword } = user;

        return NextResponse.json({
            ...userWithoutPassword,
            stats,
        });
    } catch (error) {
        apiLogger.error('Error fetching customer:', error);
        return NextResponse.json(
            { error: 'Failed to fetch customer' },
            { status: 500 }
        );
    }
}

// PATCH /api/admin/customers/[id] - Update customer
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        const existing = await userRepository.findById(id);
        if (!existing) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        // Handle role update (only ADMIN can change roles)
        if (body.role && session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Only admins can change user roles' },
                { status: 403 }
            );
        }

        // Handle specific updates
        if (body.isActive !== undefined) {
            await userRepository.setActive(id, body.isActive);
        }

        if (body.isVerified !== undefined) {
            if (body.isVerified) {
                await userRepository.setVerified(id);
            }
        }

        if (body.role) {
            const validRoles: UserRole[] = ['CUSTOMER', 'ADMIN', 'MANAGER', 'WAREHOUSE', 'SUPPORT'];
            if (!validRoles.includes(body.role)) {
                return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
            }
            await userRepository.setRole(id, body.role as UserRole);
        }

        if (body.password) {
            await userRepository.updatePassword(id, body.password);
        }

        // Update other fields
        const updateData: Record<string, unknown> = {};
        const allowedFields = ['firstName', 'lastName', 'phone', 'avatar'];

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updateData[field] = body[field];
            }
        }

        if (Object.keys(updateData).length > 0) {
            await userRepository.update(id, updateData);
        }

        // Fetch updated user
        const user = await userRepository.findById(id);
        if (!user) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        const { passwordHash, ...userWithoutPassword } = user;

        return NextResponse.json(userWithoutPassword);
    } catch (error) {
        apiLogger.error('Error updating customer:', error);
        return NextResponse.json(
            { error: 'Failed to update customer' },
            { status: 500 }
        );
    }
}

// DELETE /api/admin/customers/[id] - Delete customer (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        const existing = await userRepository.findById(id);
        if (!existing) {
            return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
        }

        // Soft delete - just deactivate
        await userRepository.setActive(id, false);

        return NextResponse.json({ success: true });
    } catch (error) {
        apiLogger.error('Error deleting customer:', error);
        return NextResponse.json(
            { error: 'Failed to delete customer' },
            { status: 500 }
        );
    }
}
