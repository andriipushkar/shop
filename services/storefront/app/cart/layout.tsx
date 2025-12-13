import { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata.cart;

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
