import { ext } from './storage';
export async function rpc<T = any>(m: Record<string, unknown>): Promise<T> {
  if (ext) {
    const r = await ext.runtime.sendMessage(m);
    if (!r?.ok) throw new Error(r?.error || '扩展已更新，请刷新网页后重试');
    return r.data;
  }
  const { handleMessage } = await import('./service');
  return handleMessage(m) as Promise<T>;
}
export function openOptions(hash = '') {
  if (ext) ext.tabs.create({ url: ext.runtime.getURL('options.html') + hash });
  else window.open('/options.html' + hash, '_blank', 'noopener');
}
