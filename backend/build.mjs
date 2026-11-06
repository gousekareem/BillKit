// Bundles the backend and the workspace packages into dist/server.js.
// Native / WASM dependencies stay external and are installed from package-lock.json.
import { build } from 'esbuild';
await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  packages: 'external',
  alias: { '@billkit/shared': '../packages/shared/src/index.ts', '@billkit/ai': '../ai/src/index.ts' },
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
});
console.log('Built dist/server.js');
