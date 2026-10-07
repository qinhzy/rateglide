import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'));
for (const [folder, label] of [
  ['chromium', 'chrome-edge'],
  ['safari-web-extension', 'safari'],
]) {
  const root = path.resolve('release', folder);
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
  if (manifest.version !== version) throw new Error('Run pnpm build before packaging.');
  await fs.mkdir(path.join(root, 'docs'), { recursive: true });
  await fs.copyFile('README.md', path.join(root, 'README.md'));
  await fs.copyFile('README.zh-CN.md', path.join(root, 'README.zh-CN.md'));
  await fs.copyFile('docs/PRIVACY.md', path.join(root, 'docs/PRIVACY.md'));
  await fs.copyFile('LICENSE', path.join(root, 'LICENSE'));
  const output = path.resolve('release', `rateglide-${label}-${version}.zip`);
  await fs.rm(output, { force: true });
  execFileSync('zip', ['-q', '-r', output, '.', '-x', '*.DS_Store'], { cwd: root });
  execFileSync('unzip', ['-tq', output], { stdio: 'pipe' });
  console.log(output);
}
// Chrome Web Store and Edge Add-ons assign their own extension IDs. The public key only keeps
// the unpacked developer-mode ID stable, so the store upload leaves it out.
{
  const root = path.resolve('release', 'store');
  await fs.rm(root, { recursive: true, force: true });
  await fs.cp(path.resolve('release', 'chromium'), root, { recursive: true });
  const file = path.join(root, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(file, 'utf8'));
  delete manifest.key;
  await fs.writeFile(file, JSON.stringify(manifest, null, 2));
  const output = path.resolve('release', `rateglide-store-${version}.zip`);
  await fs.rm(output, { force: true });
  execFileSync('zip', ['-q', '-r', output, '.', '-x', '*.DS_Store'], { cwd: root });
  execFileSync('unzip', ['-tq', output], { stdio: 'pipe' });
  console.log(output);
}
