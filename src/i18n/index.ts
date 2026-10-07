import { coreEnglish } from './messages-core';

export type Language = 'en' | 'zh-CN';
export type LanguagePreference = 'system' | Language;
export const BRAND = 'RateGlide';
const listeners = new Set<() => void>();
let preference: LanguagePreference = 'system';

export function resolveLanguage(
  value: LanguagePreference,
  browserLanguage = globalThis.navigator?.language ?? 'en',
): Language {
  return value === 'system' ? (/^zh(?:[-_]|$)/i.test(browserLanguage) ? 'zh-CN' : 'en') : value;
}
export function getLanguage() {
  return resolveLanguage(preference);
}
export function getLocale() {
  return getLanguage() === 'zh-CN' ? 'zh-CN' : 'en-US';
}
export function setLanguage(value: LanguagePreference) {
  if (value === preference) return;
  preference = value;
  for (const listener of listeners) listener();
}
export function subscribeLanguage(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Source-language keys also translate cached v1 quotes without rewriting stored data.
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The selection helper ships only the shared core table; extension pages register the rest.
const english: Record<string, string> = { ...coreEnglish };
let patterns = compile();
function compile() {
  return Object.entries(english)
    .filter(([key]) => /\{\d+\}/.test(key))
    .map(([key, value]) => {
      const slots: string[] = [];
      const source = key
        .split(/(\{\d+\})/)
        .map((part) => (/^\{\d+\}$/.test(part) ? (slots.push(part), '([\\s\\S]*?)') : escape(part)))
        .join('');
      return { expression: new RegExp('^' + source + '$'), slots, value };
    });
}
/** Adds English translations for strings beyond the shared core set. */
export function registerMessages(table: Record<string, string>) {
  Object.assign(english, table);
  patterns = compile();
}
export function translate(source: string, language: Language = getLanguage()): string {
  if (language === 'zh-CN' || !source) return source;
  if (english[source] !== undefined) return english[source];
  for (const { expression, slots, value } of patterns) {
    const match = source.match(expression);
    if (match)
      return slots.reduce(
        (text, slot, i) => text.replaceAll(slot, translate(match[i + 1], language)),
        value,
      );
  }
  // Automatic fallback notices contain independently authored sentences.
  const sentences = source.match(/[^。]+。|[^。]+$/g);
  if (sentences && sentences.length > 1)
    return sentences.map((s) => translate(s, language)).join(' ');
  return source;
}
export function t(source: string, values: readonly (string | number)[] = []): string {
  return translate(source).replace(/\{(\d+)\}/g, (_, index: string) =>
    String(values[Number(index)] ?? `{${index}}`),
  );
}
