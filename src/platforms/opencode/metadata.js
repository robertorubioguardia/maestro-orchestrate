'use strict';

const { renderJson } = require('../metadata-shared');

// Replaced by scripts/install-opencode-plugin.js with the absolute install dir.
const INSTALL_DIR_TOKEN = '__MAESTRO_INSTALL_DIR__';

function buildOpencodeMcpEntry() {
  return {
    type: 'local',
    command: ['node', `${INSTALL_DIR_TOKEN}/src/mcp/maestro-server.js`],
    environment: {
      MAESTRO_RUNTIME: 'opencode',
      MAESTRO_EXTENSION_PATH: INSTALL_DIR_TOKEN,
    },
    enabled: true,
  };
}

function buildOpencodeConfigSnippet() {
  return {
    $schema: 'https://opencode.ai/config.json',
    mcp: {
      maestro: buildOpencodeMcpEntry(),
    },
  };
}

function buildMetadataOutputs() {
  return [
    {
      outputPath: 'opencode/opencode.template.json',
      content: renderJson(buildOpencodeConfigSnippet()),
    },
  ];
}

module.exports = {
  INSTALL_DIR_TOKEN,
  buildOpencodeConfigSnippet,
  buildOpencodeMcpEntry,
  buildMetadataOutputs,
};
