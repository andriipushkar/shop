// Translations index
export { uk } from './uk';
export { en } from './en';
export { pl } from './pl';
export { de } from './de';
export type { TranslationKeys } from './uk';

import { uk } from './uk';
import { en } from './en';
import { pl } from './pl';
import { de } from './de';
import { Locale, TranslationDict } from '../i18n';

export const translations: Record<Locale, TranslationDict> = {
    uk: uk as unknown as TranslationDict,
    en: en as unknown as TranslationDict,
    pl: pl as unknown as TranslationDict,
    de: de as unknown as TranslationDict,
};

export function getTranslations(locale: Locale): TranslationDict {
    return translations[locale] || translations.uk;
}
