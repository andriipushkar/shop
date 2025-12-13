import { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import { ContactPageJsonLd, LocalBusinessJsonLd } from '@/components/ProductJsonLd';

export const metadata: Metadata = pageMetadata.contact;

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ContactPageJsonLd />
      <LocalBusinessJsonLd />
      {children}
    </>
  );
}
