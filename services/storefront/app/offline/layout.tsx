import { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata.offline;

export default function OfflineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
