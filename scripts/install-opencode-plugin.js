#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'opencode');
const INSTALL_SUBDIR = 'maestro';
const MANIFEST_NAME = 'install-manifest.json';
const CONFIG_FILE = 'opencode.json';
const TEMPLATE_FILE = 'opencode.template.json';
const INSTALL_DIR_TOKEN = '__MAESTRO_INSTALL_DIR__';
const MCP_SERVER_NAME = 'maestro';

function printHelp() {
  console.log(`Install Maestro into opencode.

Usage:
  node scripts/install-opencode-plugin.js [options]

Options:
  --global            Install into the opencode global config dir (default:
                      $OPENCODE_CONFIG_DIR, else $XDG_CONFIG_HOME/opencode,
                      else ~/.config/opencode)
  --project           Install into ./.opencode of the current directory
  --config-dir <dir>  Install into an explicit opencode config directory
  --uninstall         Remove files this installer created and the mcp.maestro entry
  --force             Overwrite existing files that Maestro did not install
  --dry-run           Show planned changes without writing files
  --help              Show this help text
`);
}

function parseArgs(argv) {
  const options = { scope: 'global', configDir: null, uninstall: false, force: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      case '--global':
        options.scope = 'global';
        break;
      case '--project':
        options.scope = 'project';
        break;
      case '--config-dir':
        i += 1;
        if (!argv[i]) throw new Error('--config-dir requires a directory argument');
        options.configDir = argv[i];
        break;
      case '--uninstall':
        options.uninstall = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function resolveConfigDir({ scope, configDir }, env = process.env, cwd = process.cwd()) {
  if (configDir) return path.resolve(configDir);
  if (scope === 'project') return path.join(cwd, '.opencode');
  if (env.OPENCODE_CONFIG_DIR) return path.resolve(env.OPENCODE_CONFIG_DIR);
  const base = env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(base, 'opencode');
}

function walkFiles(dir, base = dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(full, base));
    } else if (entry.isFile()) {
      files.push(path.relative(base, full));
    }
  }
  return files.sort();
}

function listDir(dir, filter) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(filter).sort();
}

/**
 * Plan the copy: [{ from: absolute source, to: path relative to the config dir }].
 */
function planFiles(sourceDir) {
  const plan = [];
  for (const name of listDir(path.join(sourceDir, 'agents'), (f) => f.endsWith('.md'))) {
    plan.push({ from: path.join(sourceDir, 'agents', name), to: path.join('agents', name) });
  }
  for (const name of listDir(path.join(sourceDir, 'commands'), (f) => f.endsWith('.md'))) {
    plan.push({ from: path.join(sourceDir, 'commands', name), to: path.join('commands', name) });
  }
  for (const name of listDir(path.join(sourceDir, 'skills'), () => true)) {
    const skillFile = path.join(sourceDir, 'skills', name, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      plan.push({ from: skillFile, to: path.join('skills', name, 'SKILL.md') });
    }
  }
  const pluginFile = path.join(sourceDir, 'plugins', 'maestro.js');
  if (fs.existsSync(pluginFile)) {
    plan.push({ from: pluginFile, to: path.join('plugins', 'maestro.js') });
  }
  const payloadDir = path.join(sourceDir, 'src');
  for (const rel of walkFiles(payloadDir)) {
    plan.push({ from: path.join(payloadDir, rel), to: path.join(INSTALL_SUBDIR, 'src', rel) });
  }
  return plan;
}

function readJsonFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `Cannot merge into ${file}: it is not strict JSON (${error.message}). ` +
      'Add the mcp.maestro entry manually or move your settings to opencode.jsonc.'
    );
  }
}

function readManifest(configDir) {
  const file = path.join(configDir, INSTALL_SUBDIR, MANIFEST_NAME);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function buildMcpEntry(sourceDir, installDir) {
  const template = JSON.parse(fs.readFileSync(path.join(sourceDir, TEMPLATE_FILE), 'utf8'));
  const entry = template.mcp && template.mcp[MCP_SERVER_NAME];
  if (!entry) throw new Error(`${TEMPLATE_FILE} template has no mcp.${MCP_SERVER_NAME} entry`);
  return JSON.parse(JSON.stringify(entry).split(INSTALL_DIR_TOKEN).join(installDir));
}

function sameContent(a, b) {
  return fs.existsSync(a) && fs.existsSync(b) && fs.readFileSync(a).equals(fs.readFileSync(b));
}

function pruneEmptyDirs(dir, stopAt) {
  let current = dir;
  while (current.startsWith(stopAt) && current !== stopAt) {
    if (!fs.existsSync(current) || fs.readdirSync(current).length > 0) return;
    fs.rmdirSync(current);
    current = path.dirname(current);
  }
}

function install({ sourceDir = SOURCE_DIR, configDir, dryRun = false, force = false, version = 'unknown' }) {
  if (!fs.existsSync(path.join(sourceDir, 'src', 'hooks', 'opencode-plugin.js'))) {
    throw new Error(`opencode payload not found in ${sourceDir}. Run \`node scripts/generate.js\` first.`);
  }

  const installDir = path.join(configDir, INSTALL_SUBDIR);
  const previous = readManifest(configDir);
  const owned = new Set(previous ? previous.files : []);
  const plan = planFiles(sourceDir);
  const planned = new Set(plan.map((item) => item.to));

  const conflicts = plan.filter((item) => {
    const target = path.join(configDir, item.to);
    return fs.existsSync(target) && !owned.has(item.to) && !sameContent(item.from, target);
  });
  const skipped = force ? [] : conflicts.map((item) => item.to);
  const skippedSet = new Set(skipped);
  const stale = [...owned].filter((rel) => !planned.has(rel));

  const configFile = path.join(configDir, CONFIG_FILE);
  const configExisted = fs.existsSync(configFile);
  const config = configExisted ? readJsonFile(configFile) : { $schema: 'https://opencode.ai/config.json' };
  if (!config.mcp || typeof config.mcp !== 'object') config.mcp = {};
  const mcpAction = config.mcp[MCP_SERVER_NAME] ? 'updated' : 'added';
  config.mcp[MCP_SERVER_NAME] = buildMcpEntry(sourceDir, installDir);

  const installed = plan.filter((item) => !skippedSet.has(item.to)).map((item) => item.to);

  if (!dryRun) {
    for (const item of plan) {
      if (skippedSet.has(item.to)) continue;
      const target = path.join(configDir, item.to);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(item.from, target);
    }
    for (const rel of stale) {
      fs.rmSync(path.join(configDir, rel), { force: true });
      pruneEmptyDirs(path.dirname(path.join(configDir, rel)), configDir);
    }
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
    const manifest = {
      version,
      files: installed,
      createdConfigFile: previous ? Boolean(previous.createdConfigFile) : !configExisted,
    };
    fs.mkdirSync(installDir, { recursive: true });
    fs.writeFileSync(path.join(installDir, MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`);
  }

  return { configDir, installDir, installed, skipped, removedStale: stale, mcpAction, configExisted, dryRun };
}

function uninstall({ configDir, dryRun = false }) {
  const manifest = readManifest(configDir);
  if (!manifest) {
    return { configDir, removed: [], mcpRemoved: false, notInstalled: true, dryRun };
  }

  const configFile = path.join(configDir, CONFIG_FILE);
  let mcpRemoved = false;
  let deleteConfigFile = false;
  let config = null;
  if (fs.existsSync(configFile)) {
    config = readJsonFile(configFile);
    if (config.mcp && config.mcp[MCP_SERVER_NAME]) {
      delete config.mcp[MCP_SERVER_NAME];
      mcpRemoved = true;
      if (Object.keys(config.mcp).length === 0) delete config.mcp;
      const remaining = Object.keys(config).filter((key) => key !== '$schema');
      deleteConfigFile = manifest.createdConfigFile && remaining.length === 0;
    }
  }

  if (!dryRun) {
    for (const rel of manifest.files) {
      fs.rmSync(path.join(configDir, rel), { force: true });
      pruneEmptyDirs(path.dirname(path.join(configDir, rel)), configDir);
    }
    fs.rmSync(path.join(configDir, INSTALL_SUBDIR), { recursive: true, force: true });
    if (mcpRemoved) {
      if (deleteConfigFile) {
        fs.rmSync(configFile, { force: true });
      } else {
        fs.writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);
      }
    }
  }

  return { configDir, removed: manifest.files, mcpRemoved, notInstalled: false, dryRun };
}

function readPackageVersion() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
}

function printInstallSummary(result) {
  console.log(result.dryRun ? 'Dry run complete.' : 'Maestro installed for opencode.');
  console.log(`Config dir: ${result.configDir}`);
  console.log(`Payload:    ${result.installDir}`);
  console.log(`Files:      ${result.installed.length} installed, ${result.skipped.length} skipped, ${result.removedStale.length} stale removed`);
  console.log(`MCP:        mcp.maestro ${result.mcpAction} in ${path.join(result.configDir, CONFIG_FILE)}`);
  if (result.skipped.length > 0) {
    console.log('');
    console.log('Skipped (existing files not installed by Maestro; rerun with --force to overwrite):');
    for (const rel of result.skipped) console.log(`  ${rel}`);
  }
  console.log('');
  console.log('Next steps:');
  console.log('1. Start opencode (or restart it if already open).');
  console.log('2. Run `opencode mcp list` and confirm `maestro` is connected.');
  console.log('3. Try `/orchestrate <task>` or `/review-code`.');
}

function printUninstallSummary(result) {
  if (result.notInstalled) {
    console.log(`No Maestro install found in ${result.configDir}. Nothing to do.`);
    return;
  }
  console.log(result.dryRun ? 'Dry run complete.' : 'Maestro removed from opencode.');
  console.log(`Config dir: ${result.configDir}`);
  console.log(`Files:      ${result.removed.length} removed; mcp.maestro ${result.mcpRemoved ? 'removed' : 'was not present'}`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const configDir = resolveConfigDir(options);
  if (options.uninstall) {
    printUninstallSummary(uninstall({ configDir, dryRun: options.dryRun }));
    return;
  }
  printInstallSummary(install({
    configDir,
    dryRun: options.dryRun,
    force: options.force,
    version: readPackageVersion(),
  }));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { install, uninstall, parseArgs, planFiles, resolveConfigDir };
