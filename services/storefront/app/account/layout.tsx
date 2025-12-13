import { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';

export const metadata: Metadata = pageMetadata.account;

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
