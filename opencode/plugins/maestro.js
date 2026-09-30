import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

// Installed layout: <config>/plugins/maestro.js next to <config>/maestro/src.
// Repo layout: opencode/plugins/maestro.js next to opencode/src (payload) and ../src (canonical).
const CANDIDATE_ROOTS = [
  path.resolve(here, '../maestro'),
  path.resolve(here, '..'),
  path.resolve(here, '../..'),
];

function resolveExtensionRoot() {
  const root = CANDIDATE_ROOTS.find((candidate) =>
    fs.existsSync(path.join(candidate, 'src', 'hooks', 'opencode-plugin.js')));
  if (!root) {
    throw new Error(`Maestro plugin cannot find its runtime payload near ${here}`);
  }
  return root;
}

export const MaestroPlugin = async ({ directory }) => {
  const extensionRoot = resolveExtensionRoot();
  const { createOpencodeHooks } = require(path.join(extensionRoot, 'src', 'hooks', 'opencode-plugin.js'));
  return createOpencodeHooks({ directory, extensionRoot });
};
