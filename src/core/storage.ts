import { currencyCodes } from '../data/currencies';
import { resolveLanguage } from '../i18n';
import { DEFAULTS, type Settings } from './types';
export const ext: typeof chrome | undefined =
  (globalThis as unknown as { browser?: typeof chrome; chrome?: typeof chrome }).browser ??
  (globalThis.chrome?.runtime?.id ? globalThis.chrome : undefined);
export const isExtension = !!ext?.runtime?.id;
export async function read<T>(key: string, fallback: T): Promise<T> {
  if (ext?.storage) {
    const data = await ext.storage.local.get(key);
    return (data[key] as T) ?? fallback;
  }
  try {
    return JSON.parse(localStorage.getItem('huijian:' + key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
export async function write(key: string, value: unknown) {
  if (ext?.storage) await ext.storage.local.set({ [key]: value });
  else localStorage.setItem('huijian:' + key, JSON.stringify(value));
}
export function cleanSettings(input: Partial<Settings>): Settings {
  const s = { ...DEFAULTS, ...input };
  const valid = (x: string) => currencyCodes.has(x);
  if (!['system', 'en', 'zh-CN'].includes(s.language)) s.language = 'system';
  for (const key of ['target', 'defaultDollar', 'defaultYen', 'defaultCurrency'] as const)
    if (!valid(s[key])) s[key] = DEFAULTS[key];
  for (const key of ['enabled', 'numbersOnly', 'rememberHistory'] as const)
    s[key] = typeof s[key] === 'boolean' ? s[key] : DEFAULTS[key];
  if (!['auto', 'wise', 'market', 'ecb', 'boc', 'visa', 'mastercard', 'revolut'].includes(s.source))
    s.source = 'auto';
  if (!['prompt', 'instant', 'alt'].includes(s.mode)) s.mode = 'prompt';
  if (!['system', 'light', 'dark'].includes(s.theme)) s.theme = 'system';
  s.bankFee = Number.isFinite(Number(s.bankFee)) ? Math.max(0, Math.min(30, Number(s.bankFee))) : 0;
  s.favorites = Array.isArray(s.favorites)
    ? [...new Set(s.favorites.filter(valid))].slice(0, 20)
    : DEFAULTS.favorites;
  s.blockedSites = Array.isArray(s.blockedSites)
    ? [
        ...new Set(
          s.blockedSites
            .filter((x) => typeof x === 'string')
            .map(
              (x) =>
                x
                  .trim()
                  .toLowerCase()
                  .replace(/^https?:\/\//, '')
                  .split('/')[0],
            )
            .filter((x) => /^[a-z0-9.-]+(?::\d+)?$/.test(x)),
        ),
      ].slice(0, 200)
    : [];
  return s;
}
export async function getSettings() {
  const stored = await read<Partial<Settings> | null>('settings', null);
  return cleanSettings(
    stored ?? { ...DEFAULTS, target: resolveLanguage('system') === 'en' ? 'USD' : 'CNY' },
  );
}
export async function saveSettings(patch: Partial<Settings>) {
  const s = cleanSettings({ ...(await getSettings()), ...patch });
  await write('settings', s);
  return s;
}
/** A sensible other side for a conversion from `code`: home currency, then the watchlist. */
export function otherCurrency(code: string, settings: Settings) {
  return [settings.target, ...settings.favorites, 'USD', 'EUR'].find((c) => c !== code)!;
}
export function siteBlocked(host: string, blocked: string[]) {
  return blocked.some((b) => host === b || host.endsWith('.' + b));
}
