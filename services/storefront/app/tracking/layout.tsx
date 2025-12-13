import { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata.tracking;

export default function TrackingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
