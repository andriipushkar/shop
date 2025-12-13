import { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata.returns;

export default function ReturnsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
