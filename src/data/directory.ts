export type ProviderLink = {
  name: string;
  short: string;
  category: '汇款平台' | '银行' | '卡组织';
  note: string;
  color: string;
};
export const directory: ProviderLink[] = [
  {
    name: 'Wise',
    short: 'W',
    category: '汇款平台',
    note: '实时中间价与汇款费用估算',
    color: '#145642',
  },
  {
    name: 'HSBC 汇丰',
    short: 'H',
    category: '银行',
    note: 'Wise 采集的汇丰地区报价，按币种与地区查询',
    color: '#d51e32',
  },
  {
    name: 'Revolut',
    short: 'R',
    category: '汇款平台',
    note: '官方公开换币报价，可选择账户地区',
    color: '#1c2739',
  },
  {
    name: 'PayPal',
    short: 'P',
    category: '汇款平台',
    note: 'Wise 采集的汇款报价估算，非个人钱包报价',
    color: '#1266ad',
  },
  {
    name: 'Visa',
    short: 'V',
    category: '卡组织',
    note: '官方公布价、历史日期与发卡行费用',
    color: '#172d83',
  },
  {
    name: 'Mastercard 万事达',
    short: 'M',
    category: '卡组织',
    note: '官方公布价、历史日期与发卡行费用',
    color: '#d56319',
  },
  {
    name: '中国银行',
    short: '中',
    category: '银行',
    note: '官方现汇买入与卖出牌价',
    color: '#a61b32',
  },
  ...[
    'Remitly',
    'Western Union 西联',
    'OFX',
    'Instarem',
    'Moneygram 速汇金',
    'Skrill',
    'Monese',
  ].map((name) => ({
    name,
    short: name[0],
    category: '汇款平台' as const,
    note: 'Wise 采集估算，费用与到账金额在插件内展示',
    color: '#365763',
  })),
  ...['NatWest', 'RBS', 'Barclays', 'Santander UK', 'Lloyds', 'Nationwide', 'Halifax'].map(
    (name) => ({
      name,
      short: name[0],
      category: '银行' as const,
      note: 'Wise 采集估算，费用与到账金额在插件内展示',
      color: '#365763',
    }),
  ),
];
export const countries = [
  ['', '不限地区'],
  ['CN', '中国大陆'],
  ['HK', '中国香港'],
  ['US', '美国'],
  ['GB', '英国'],
  ['DE', '德国'],
  ['FR', '法国'],
  ['ES', '西班牙'],
  ['IE', '爱尔兰'],
  ['CA', '加拿大'],
  ['AU', '澳大利亚'],
  ['NZ', '新西兰'],
  ['SG', '新加坡'],
  ['JP', '日本'],
  ['IN', '印度'],
  ['PH', '菲律宾'],
  ['TH', '泰国'],
  ['MY', '马来西亚'],
  ['AE', '阿联酋'],
  ['CH', '瑞士'],
  ['TW', '中国台湾'],
];
