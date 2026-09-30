module.exports = {
  name: 'opencode',
  outputDir: 'opencode/',

  agentNaming: 'kebab-case',

  env: {
    extensionPath: 'MAESTRO_EXTENSION_PATH',
    workspacePath: 'MAESTRO_WORKSPACE_PATH',
  },

  content: {
    primary: 'filesystem',
    fallback: 'none',
  },

  tools: {
    read_file: 'read',
    list_directory: 'list',
    glob: 'glob',
    grep_search: 'grep',
    google_web_search: 'websearch',
    web_fetch: 'webfetch',
    write_file: 'write',
    replace: 'edit',
    run_shell_command: 'bash',
    ask_user: 'question',
    read_many_files: 'read',
    write_todos: 'todowrite',
    activate_skill: 'skill',
    enter_plan_mode: 'switch to the plan agent',
    exit_plan_mode: 'question approval',
    codebase_investigator: 'task (explore) / grep / glob',
  },

  agentFrontmatter: {
    mode: 'subagent',
    turnsField: 'steps',
    hasTemperature: true,
  },

  delegation: {
    pattern: 'task(subagent_type: "{{agent}}", prompt: "...")',
    constraints: {
      result_surface: 'synchronous',
      child_cannot_prompt_user: false,
    },
  },

  features: {
    exampleBlocks: false,
    claudeStateContract: false,
    scriptBasedStateContract: false,
    codexStateContract: false,
    opencodeStateContract: true,
  },

  paths: {
    skills: '${MAESTRO_EXTENSION_PATH}/skills/',
    hooks: '${MAESTRO_EXTENSION_PATH}/plugins/',
  },
};
