import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { userRepository } from '@/lib/db/repositories/user.repository';
import { parsePagination, parseEnumParam } from '@/lib/security/pagination';
import type { UserRole } from '@prisma/client';
import { apiLogger } from '@/lib/logger';

const VALID_USER_ROLES: readonly UserRole[] = ['CUSTOMER', 'ADMIN', 'MANAGER', 'SUPPORT', 'WAREHOUSE'] as const;

/**
 * GET /api/admin/customers - List customers with filters
 * @description Fetches paginated list of customers for admin panel
 * @param request - NextRequest with query params: page, pageSize, search, role, isVerified, isActive
 * @returns Paginated customers list with total count
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER', 'SUPPORT'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);

        // Secure pagination with bounds validation (prevents DoS)
        const { page, pageSize } = parsePagination(
            searchParams.get('page'),
            searchParams.get('pageSize'),
            { maxPageSize: 100, defaultPageSize: 20 }
        );

        const search = searchParams.get('search') || undefined;
        const role = parseEnumParam(searchParams.get('role'), VALID_USER_ROLES);
        const isVerified = searchParams.get('isVerified');
        const isActive = searchParams.get('isActive');

        const result = await userRepository.findMany(
            {
                search,
                role,
                isVerified: isVerified !== null ? isVerified === 'true' : undefined,
                isActive: isActive !== null ? isActive === 'true' : undefined,
            },
            page,
            pageSize
        );

        return NextResponse.json(result);
    } catch (error) {
        apiLogger.error('Error fetching customers:', error);
        return NextResponse.json(
            { error: 'Failed to fetch customers' },
            { status: 500 }
        );
    }
}

// POST /api/admin/customers - Create customer
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user || !['ADMIN', 'MANAGER'].includes(session.user.role)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        const { email } = body;
        if (!email) {
            return NextResponse.json(
                { error: 'Email is required' },
                { status: 400 }
            );
        }

        // Check if email already exists
        const existing = await userRepository.findByEmail(email);
        if (existing) {
            return NextResponse.json(
                { error: 'User with this email already exists' },
                { status: 409 }
            );
        }

        const user = await userRepository.create({
            email,
            password: body.password,
            firstName: body.firstName,
            lastName: body.lastName,
            phone: body.phone,
            role: body.role || 'CUSTOMER',
        });

        // Remove sensitive data
        const { ...userWithoutPassword } = user;

        return NextResponse.json(userWithoutPassword, { status: 201 });
    } catch (error) {
        apiLogger.error('Error creating customer:', error);
        return NextResponse.json(
            { error: 'Failed to create customer' },
            { status: 500 }
        );
    }
}
