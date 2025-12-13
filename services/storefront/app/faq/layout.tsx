import { Metadata } from 'next';
import { pageMetadata } from '@/lib/metadata';
import { FAQJsonLd } from '@/components/ProductJsonLd';

export const metadata: Metadata = pageMetadata.faq;

// FAQ data for structured data (same as on the page)
const faqItems = [
  { question: 'Як зробити замовлення?', answer: 'Додайте товари в кошик, перейдіть до оформлення замовлення, вкажіть контактні дані, оберіть спосіб доставки та оплати.' },
  { question: 'Як відстежити моє замовлення?', answer: 'Перейдіть в особистий кабінет > Мої замовлення. Там ви знайдете всю інформацію про статус та номер для відстеження.' },
  { question: 'Які способи доставки доступні?', answer: 'Нова Пошта (відділення та кур\'єр), Укрпошта, Meest, самовивіз. Терміни доставки: 1-3 дні для більшості міст України.' },
  { question: 'Скільки коштує доставка?', answer: 'Доставка безкоштовна при замовленні від 1000 грн. Для менших замовлень: Нова Пошта від 50 грн, кур\'єр від 80 грн.' },
  { question: 'Які способи оплати ви приймаєте?', answer: 'Картки Visa/Mastercard онлайн, LiqPay, Приват24, Apple Pay, Google Pay, накладений платіж.' },
  { question: 'Чи безпечно оплачувати карткою?', answer: 'Так, всі платежі захищені за стандартом PCI DSS та технологією 3D Secure.' },
  { question: 'Протягом якого часу можна повернути товар?', answer: '14 днів з моменту отримання для товару належної якості. Для бракованого товару - протягом гарантійного терміну.' },
  { question: 'Як повернути товар?', answer: 'Зв\'яжіться з підтримкою або заповніть форму повернення в особистому кабінеті. Ми надішлемо інструкції для відправки.' },
];

export default function FaqLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <FAQJsonLd items={faqItems} />
      {children}
    </>
  );
}
