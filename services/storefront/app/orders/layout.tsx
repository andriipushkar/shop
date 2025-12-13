import { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata.orders;

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
