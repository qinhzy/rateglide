import { build as viteBuild } from 'vite';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import { createHash, generateKeyPairSync } from 'node:crypto';
import sharp from 'sharp';
await viteBuild();
await build({
  entryPoints: ['src/background.ts'],
  outfile: 'dist/background.js',
  bundle: true,
  format: 'iife',
  target: ['chrome110', 'safari16'],
  minify: true,
});
await build({
  entryPoints: ['src/content/index.ts'],
  outfile: 'dist/content.js',
  bundle: true,
  format: 'iife',
  target: ['chrome110', 'safari16'],
  minify: true,
  loader: { '.css': 'text' },
});
let key;
try {
  key = await fs.readFile('design/extension-public-key.txt', 'utf8');
} catch {
  key = generateKeyPairSync('rsa', { modulusLength: 2048 })
    .publicKey.export({ type: 'spki', format: 'der' })
    .toString('base64');
  await fs.writeFile('design/extension-public-key.txt', key);
}
const manifest = {
  manifest_version: 3,
  default_locale: 'en',
  name: '__MSG_extensionName__',
  short_name: 'RateGlide',
  description: '__MSG_extensionDescription__',
  version: JSON.parse(await fs.readFile('package.json', 'utf8')).version,
  minimum_chrome_version: '110',
  key,
  permissions: ['storage', 'contextMenus', 'clipboardWrite'],
  host_permissions: [
    'https://wise.com/*',
    'https://api.wise.com/*',
    'https://open.er-api.com/*',
    'https://api.frankfurter.dev/*',
    'https://www.boc.cn/*',
    'https://www.visa.co.uk/*',
    'https://www.mastercard.com/*',
    'https://www.revolut.com/*',
  ],
  background: { service_worker: 'background.js' },
  action: {
    default_popup: 'popup.html?popup=1',
    default_title: '__MSG_actionTitle__',
    default_icon: {
      16: 'icons/16.png',
      32: 'icons/32.png',
      48: 'icons/48.png',
      128: 'icons/128.png',
    },
  },
  icons: { 16: 'icons/16.png', 32: 'icons/32.png', 48: 'icons/48.png', 128: 'icons/128.png' },
  options_ui: { page: 'options.html', open_in_tab: true },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['content.js'],
      run_at: 'document_idle',
      all_frames: true,
    },
  ],
  commands: {
    'convert-selection': {
      suggested_key: { default: 'Alt+Shift+C', mac: 'Alt+Shift+C' },
      description: '__MSG_convertSelection__',
    },
  },
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'none'; base-uri 'none'",
  },
};
await fs.mkdir('dist/icons', { recursive: true });
for (const size of [16, 32, 48, 128, 256, 512]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect x="2" y="2" width="124" height="124" rx="30" fill="#145642"/><g fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M25 35h16l44 58h18m-18-18 18 18-18 6M25 93h16l44-58h18M85 29l18 6-18 18"/></g></svg>`;
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`dist/icons/${size}.png`);
}
await fs.writeFile('dist/manifest.json', JSON.stringify(manifest, null, 2));
await fs.mkdir('release', { recursive: true });
await fs.rm('release/chromium', { recursive: true, force: true });
await fs.cp('dist', 'release/chromium', { recursive: true });
await fs.rm('release/safari-web-extension', { recursive: true, force: true });
await fs.cp('dist', 'release/safari-web-extension', { recursive: true });
const safari = { ...manifest };
delete safari.key;
delete safari.minimum_chrome_version;
safari.background = { scripts: ['background.js'], persistent: false };
await fs.writeFile('release/safari-web-extension/manifest.json', JSON.stringify(safari, null, 2));
const id = createHash('sha256')
  .update(Buffer.from(key, 'base64'))
  .digest('hex')
  .slice(0, 32)
  .split('')
  .map((c) => String.fromCharCode(97 + parseInt(c, 16)))
  .join('');
await fs.writeFile('release/extension-id.txt', id + '\n');
console.log(
  `Chrome / Edge: release/chromium\nSafari resources: release/safari-web-extension\nExtension ID: ${id}`,
);
