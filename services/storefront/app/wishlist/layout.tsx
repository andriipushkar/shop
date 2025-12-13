import { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata.wishlist;

export default function WishlistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
