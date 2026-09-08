export type Source = 'auto' | 'wise' | 'market' | 'ecb' | 'boc' | 'visa' | 'mastercard' | 'revolut';
export type CardNetwork = 'visa' | 'mastercard';
export type CardInput = {
  network: CardNetwork;
  from: string;
  to: string;
  amount: number;
  bankFee: number;
  date: string;
};
export type CardQuote = CardInput & {
  rate: number;
  baseRate: number;
  total: number;
  feeAmount: number;
  rateDate: string;
  asOf: number;
  updatedAt?: number;
  fetchedAt: number;
  cached?: boolean;
  stale?: boolean;
};
export type RevolutQuote = {
  from: string;
  to: string;
  amount: number;
  received: number;
  rate: number;
  asOf: number;
  fetchedAt: number;
  country: string;
  plans: { id: string; name: string; fee: number; cost: number }[];
};
export type Quote = {
  from: string;
  to: string;
  rate: number;
  source: Exclude<Source, 'auto'>;
  label: string;
  kind: string;
  asOf: number;
  fetchedAt: number;
  cached?: boolean;
  stale?: boolean;
  notice?: string;
  url: string;
};
export type Settings = {
  version: 1;
  language: 'system' | 'en' | 'zh-CN';
  enabled: boolean;
  target: string;
  defaultDollar: string;
  defaultYen: string;
  defaultCurrency: string;
  source: Source;
  mode: 'prompt' | 'instant' | 'alt';
  numbersOnly: boolean;
  theme: 'system' | 'light' | 'dark';
  blockedSites: string[];
  favorites: string[];
  rememberHistory: boolean;
  bankFee: number;
};
export type ParsedMoney = {
  amount: number;
  currency: string;
  raw: string;
  ambiguous: boolean;
  hint?: string;
};
export type HistoryEntry = {
  id: string;
  amount: number;
  from: string;
  to: string;
  result: number;
  source: string;
  time: number;
};
export type CompareRow = {
  id: string;
  name: string;
  type: string;
  rate: number;
  fee: number;
  received: number;
  collectedAt: number;
  payIn: string;
  payOut: string;
  sourceCountry?: string;
  targetCountry?: string;
  url: string;
};
export const DEFAULTS: Settings = {
  version: 1,
  language: 'system',
  enabled: true,
  target: 'CNY',
  defaultDollar: 'USD',
  defaultYen: 'JPY',
  defaultCurrency: 'USD',
  source: 'auto',
  mode: 'prompt',
  numbersOnly: false,
  theme: 'system',
  blockedSites: [],
  favorites: ['USD', 'EUR', 'GBP', 'JPY', 'HKD', 'SGD'],
  rememberHistory: false,
  bankFee: 0,
};
