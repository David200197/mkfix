#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');

// ─── Constants ────────────────────────────────────────────────────────────────

const MKFIX_FOLDER = 'mkfix';
const SKILL_FILENAME = 'mkfix-skill.md';

const COLORS = {
  reset:  '\x1b[0m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  white:  '\x1b[37m',
};

const CHANGE_TYPES = ['fix', 'add', 'remove'];

// ─── Utilities ────────────────────────────────────────────────────────────────

const log = (message, color = 'white') =>
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);

const die = (message, color = 'red') => {
  log(message, color);
  process.exit(1);
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

// ─── Validation ───────────────────────────────────────────────────────────────

function validateChangeItem(change, itemIndex, changeIndex) {
  const prefix = `Item ${itemIndex}: changes[${changeIndex}]`;
  const errors = [];

  if (!change || typeof change !== 'object') {
    return [`${prefix} must be an object`];
  }

  if (!CHANGE_TYPES.includes(change.type)) {
    errors.push(`${prefix}.type must be one of: ${CHANGE_TYPES.join(', ')}`);
  }

  if (typeof change.line !== 'number' || change.line < 1) {
    errors.push(`${prefix}.line must be a positive number`);
  }

  const requires = {
    fix:    { old_code: true,  new_code: true  },
    add:    { old_code: false, new_code: true  },
    remove: { old_code: true,  new_code: false },
  };

  const rules = requires[change.type];
  if (rules) {
    if (rules.old_code  && typeof change.old_code !== 'string')
      errors.push(`${prefix}.old_code is required for type "${change.type}"`);
    if (!rules.old_code && change.old_code !== undefined)
      errors.push(`${prefix}.old_code must not be set for type "${change.type}"`);
    if (rules.new_code  && typeof change.new_code !== 'string')
      errors.push(`${prefix}.new_code is required for type "${change.type}"`);
    if (!rules.new_code && change.new_code !== undefined)
      errors.push(`${prefix}.new_code must not be set for type "${change.type}"`);
  }

  return errors;
}

function validateConfigItem(item, index) {
  if (!item || typeof item !== 'object') return [`Item ${index}: Must be an object`];

  const errors = [];

  if (!item.path || typeof item.path !== 'string')
    errors.push(`Item ${index}: 'path' must be a non-empty string`);

  const hasCode    = 'code'    in item;
  const hasChanges = 'changes' in item;

  if (!hasCode && !hasChanges)
    errors.push(`Item ${index}: Must have either 'code' or 'changes' property`);
  if (hasCode && hasChanges)
    errors.push(`Item ${index}: 'code' and 'changes' are mutually exclusive`);
  if (hasCode && typeof item.code !== 'string')
    errors.push(`Item ${index}: 'code' must be a string`);

  if (hasChanges) {
    if (!Array.isArray(item.changes)) {
      errors.push(`Item ${index}: 'changes' must be an array`);
    } else if (item.changes.length === 0) {
      errors.push(`Item ${index}: 'changes' array cannot be empty`);
    } else {
      item.changes.forEach((change, ci) =>
        errors.push(...validateChangeItem(change, index, ci))
      );
    }
  }

  return errors;
}

function validateConfig(config) {
  if (!Array.isArray(config)) return ['Configuration must be an array'];
  if (config.length === 0)    return ['Configuration array cannot be empty'];

  return config.flatMap((item, i) => validateConfigItem(item, i));
}

function checkChangesFileExists(config, rootPath) {
  return config.flatMap((item, index) => {
    if (!item.changes) return [];
    const filePath = path.join(rootPath, item.path);
    return fs.existsSync(filePath)
      ? []
      : [`Item ${index}: File does not exist at path '${item.path}' (required for changes operation)`];
  });
}

// ─── File Operations ──────────────────────────────────────────────────────────

function applyCodeChange(filePath, code) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, code, 'utf8');
}

function applySingleChange(lines, change) {
  const startIndex = change.line - 1;

  const verifyMatch = (type) => {
    const oldLines = change.old_code.split('\n');
    const actual   = lines.slice(startIndex, startIndex + oldLines.length).join('\n');
    if (actual !== change.old_code) {
      throw new Error(
        `[${type}] Code mismatch at line ${change.line}.\nExpected:\n${change.old_code}\nFound:\n${actual}`
      );
    }
    return oldLines;
  };

  if (change.type === 'fix') {
    const oldLines = verifyMatch('fix');
    lines.splice(startIndex, oldLines.length, ...change.new_code.split('\n'));
  } else if (change.type === 'add') {
    lines.splice(startIndex + 1, 0, ...change.new_code.split('\n'));
  } else if (change.type === 'remove') {
    const oldLines = verifyMatch('remove');
    lines.splice(startIndex, oldLines.length);
  }
}

function applyChangesToFile(filePath, changesArray) {
  const lines  = fs.readFileSync(filePath, 'utf8').split('\n');
  const sorted = [...changesArray].sort((a, b) => b.line - a.line);
  for (const change of sorted) applySingleChange(lines, change);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

function applyChanges(config, rootPath) {
  return config.map((item, index) => {
    const filePath = path.join(rootPath, item.path);
    const type     = item.code !== undefined ? 'code' : 'changes';

    try {
      if (type === 'code') {
        applyCodeChange(filePath, item.code);
        return { index, path: item.path, type, status: 'success', message: 'File updated successfully' };
      } else {
        applyChangesToFile(filePath, item.changes);
        return { index, path: item.path, type, status: 'success', message: `Applied ${item.changes.length} change(s) successfully` };
      }
    } catch (error) {
      return { index, path: item.path, type, status: 'error', message: error.message };
    }
  });
}

// ─── Commands ─────────────────────────────────────────────────────────────────

function createConfig() {
  const rootPath      = process.cwd();
  const mkfixPath     = path.join(rootPath, MKFIX_FOLDER);
  const gitignorePath = path.join(rootPath, '.gitignore');

  if (!fs.existsSync(mkfixPath)) {
    fs.mkdirSync(mkfixPath);
    log(`✓ Created '${MKFIX_FOLDER}' folder`, 'green');
  } else {
    log(`'${MKFIX_FOLDER}' folder already exists`, 'yellow');
  }

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    if (!content.includes(MKFIX_FOLDER)) {
      const newline = content.endsWith('\n') ? '' : '\n';
      fs.appendFileSync(gitignorePath, `${newline}${MKFIX_FOLDER}/\n`, 'utf8');
      log(`✓ Added '${MKFIX_FOLDER}/' to .gitignore`, 'green');
    } else {
      log(`'${MKFIX_FOLDER}' is already in .gitignore`, 'yellow');
    }
  } else {
    fs.writeFileSync(gitignorePath, `${MKFIX_FOLDER}/\n`, 'utf8');
    log(`✓ Created .gitignore with '${MKFIX_FOLDER}/' entry`, 'green');
  }
}

function downloadSkill() {
  fs.writeFileSync(path.join(process.cwd(), SKILL_FILENAME), getSkillTemplate(), 'utf8');
  log(`✓ Skill template downloaded to '${SKILL_FILENAME}'`, 'green');
}

function getConfigFiles(mkfixPath) {
  if (!fs.existsSync(mkfixPath)) return [];
  return fs.readdirSync(mkfixPath)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

async function processConfig(configName, mkfixPath, rootPath) {
  const configPath = path.join(mkfixPath, `${configName}.json`);
  log(`\nLoading configuration: ${configName}`, 'cyan');

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    die(`✗ Error reading configuration file: ${err.message}`);
  }

  log('Validating configuration...', 'cyan');

  const validationErrors = validateConfig(config);
  if (validationErrors.length > 0) {
    log('\n✗ Configuration validation failed:', 'red');
    validationErrors.forEach(err => log(`  - ${err}`, 'red'));
    process.exit(1);
  }

  const fileErrors = checkChangesFileExists(config, rootPath);
  if (fileErrors.length > 0) {
    log('\n✗ File existence check failed:', 'red');
    fileErrors.forEach(err => log(`  - ${err}`, 'red'));
    process.exit(1);
  }

  log('✓ Configuration is valid', 'green');
  log('\nApplying changes...', 'cyan');

  const results = applyChanges(config, rootPath);
  console.log('');

  let successCount = 0;
  let errorCount   = 0;

  results.forEach(({ index, path: p, message, status }) => {
    if (status === 'success') {
      successCount++;
      log(`  ✓ [${index}] ${p}: ${message}`, 'green');
    } else {
      errorCount++;
      log(`  ✗ [${index}] ${p}: ${message}`, 'red');
    }
  });

  console.log('');
  log(`Summary: ${successCount} successful, ${errorCount} failed`, errorCount > 0 ? 'yellow' : 'green');
}

async function interactiveMode() {
  const rootPath  = process.cwd();
  const mkfixPath = path.join(rootPath, MKFIX_FOLDER);

  if (!fs.existsSync(mkfixPath)) {
    log(`\n✗ The '${MKFIX_FOLDER}' folder does not exist in the current directory.`, 'red');
    log(`\n  Run 'mkfix -c' to create the folder and set up configuration.`, 'cyan');
    die(`  Then place your JSON configuration files in the '${MKFIX_FOLDER}' folder.\n`, 'white');
  }

  const configFiles = getConfigFiles(mkfixPath);

  if (configFiles.length === 0) {
    log(`\n✗ No JSON configuration files found in the '${MKFIX_FOLDER}' folder.`, 'red');
    die(`\n  Place your JSON configuration files in the '${MKFIX_FOLDER}' folder and try again.\n`);
  }

  try {
    const { selectedConfig } = await inquirer.prompt([{
      type:     'list',
      name:     'selectedConfig',
      message:  'Select a configuration to apply',
      choices:  configFiles,
      pageSize: 10,
    }]);

    await processConfig(selectedConfig, mkfixPath, rootPath);
  } catch {
    log('\nOperation cancelled.', 'yellow');
    process.exit(0);
  }
}

// ─── Argument Parsing ─────────────────────────────────────────────────────────

function parseArgs(args) {
  const options = { help: false, config: false, skill: false, downloadSkill: false, input: null };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if      (arg === '-h' || arg === '--help')            options.help          = true;
    else if (arg === '-c' || arg === '--config')          options.config        = true;
    else if (arg === '-s' || arg === '--skill')           options.skill         = true;
    else if (arg === '-ds'|| arg === '--download-skill')  options.downloadSkill = true;
    else if (arg === '-i' || arg === '--input') {
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        options.input = args[++i];
      } else {
        die('Error: --input requires a configuration name');
      }
    }
  }

  return options;
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help)          { showHelp();                      process.exit(0); }
  if (options.config)        { createConfig();                  process.exit(0); }
  if (options.skill)         { console.log(getSkillTemplate()); process.exit(0); }
  if (options.downloadSkill) { downloadSkill();                 process.exit(0); }

  if (options.input) {
    const rootPath  = process.cwd();
    const mkfixPath = path.join(rootPath, MKFIX_FOLDER);
    if (!fs.existsSync(mkfixPath)) {
      log(`\n✗ The '${MKFIX_FOLDER}' folder does not exist.`, 'red');
      die(`  Run 'mkfix -c' to create it first.\n`);
    }
    await processConfig(options.input, mkfixPath, rootPath);
    process.exit(0);
  }

  await interactiveMode();
}

main().catch(err => die(`\nUnexpected error: ${err.message}`));

// ─── Skill Template ───────────────────────────────────────────────────────────

function getSkillTemplate() {
  return `# mkfix - AI Code Fix Skill

When I ask you to fix an error or make code changes, you MUST respond with a JSON configuration that follows this exact format. The response must be a valid JSON array.

## Response Format

\`\`\`json
[
  {
    "path": "relative/path/to/file.ext",
    "code": "entire file content as string"
  }
]
\`\`\`

OR for targeted changes:

\`\`\`json
[
  {
    "path": "relative/path/to/file.ext",
    "changes": [
      {
        "type": "fix" | "add" | "remove",
        "line": <line_number>,
        "old_code": "exact code at that line (required for fix and remove)",
        "new_code": "replacement or new code (required for fix and add)"
      }
    ]
  }
]
\`\`\`

## Change Types

| type     | line | old_code | new_code | Behavior                              |
|----------|------|----------|----------|---------------------------------------|
| \`fix\`    | ✅   | ✅       | ✅       | Replaces old_code with new_code       |
| \`add\`    | ✅   | ❌       | ✅       | Inserts new_code **after** the line   |
| \`remove\` | ✅   | ✅       | ❌       | Deletes old_code starting at the line |

## Rules

1. **Mutually Exclusive**: Use either \`code\` OR \`changes\`, never both in the same object
2. **Path**: Always use relative paths from the project root
3. **code**: Use when creating new files or completely rewriting existing ones
4. **changes**: Use for targeted edits — the file must already exist
5. **changes is an array**: Multiple operations can be applied to the same file
6. **old_code**: Must match the exact code in the file at the specified line (including whitespace)
7. **line**: 1-based line number where the operation starts
8. **Multiple files**: Use multiple objects in the array

## Examples

### Creating a new file:

\`\`\`json
[
  {
    "path": "src/utils/helper.js",
    "code": "export function formatDate(date) {\\n  return new Date(date).toLocaleDateString();\\n}"
  }
]
\`\`\`

### Fix — replace specific lines:

\`\`\`json
[
  {
    "path": "src/components/Button.tsx",
    "changes": [
      {
        "type": "fix",
        "line": 15,
        "old_code": "const [count, setCount] = useState(0);",
        "new_code": "const [count, setCount] = useState(1);"
      }
    ]
  }
]
\`\`\`

### Add — insert lines after a given line:

\`\`\`json
[
  {
    "path": "src/config.js",
    "changes": [
      {
        "type": "add",
        "line": 3,
        "new_code": "export const DEBUG = process.env.DEBUG === 'true';"
      }
    ]
  }
]
\`\`\`

### Remove — delete specific lines:

\`\`\`json
[
  {
    "path": "src/config.js",
    "changes": [
      {
        "type": "remove",
        "line": 7,
        "old_code": "console.log('debug mode on');"
      }
    ]
  }
]
\`\`\`

### Mixed changes in the same file:

\`\`\`json
[
  {
    "path": "src/api/users.js",
    "changes": [
      {
        "type": "remove",
        "line": 5,
        "old_code": "const limit = 10;"
      },
      {
        "type": "add",
        "line": 5,
        "new_code": "const limit = 20;\\nconst offset = 0;"
      },
      {
        "type": "fix",
        "line": 25,
        "old_code": "return res.send(data);",
        "new_code": "return res.json(data);"
      }
    ]
  }
]
\`\`\`

### Multiple files:

\`\`\`json
[
  {
    "path": "src/api/users.js",
    "changes": [
      {
        "type": "fix",
        "line": 25,
        "old_code": "const limit = 10;",
        "new_code": "const limit = 20;"
      }
    ]
  },
  {
    "path": "src/config.js",
    "code": "export const API_URL = 'https://api.example.com';\\nexport const TIMEOUT = 5000;"
  }
]
\`\`\`

## Important Notes

- Always ensure the JSON is valid and properly escaped
- For multi-line strings in JSON, use \`\\n\` for newlines
- \`old_code\` must match exactly what's in the file (including whitespace and indentation)
- Changes within a file are applied in reverse line order automatically to avoid offset issues
`;
}

function showHelp() {
  console.log(`
 ${COLORS.cyan}mkfix${COLORS.reset} - A CLI tool to quickly apply AI-suggested code changes

 ${COLORS.yellow}Usage:${COLORS.reset}
  mkfix                          Start interactive mode to select and apply changes
  mkfix [options]                Run with specific options

 ${COLORS.yellow}Options:${COLORS.reset}
  -i, --input <name>             Skip selection and apply the specified config file directly
  -c, --config                   Create the mkfix folder and add it to .gitignore
  -s, --skill                    Print the AI skill template for generating fix configurations
  -ds, --download-skill          Download the AI skill template to current directory
  -h, --help                     Show this help message

 ${COLORS.yellow}Examples:${COLORS.reset}
  mkfix                          Interactive mode
  mkfix -i fix-bug-123           Apply fix-bug-123.json directly
  mkfix -c                       Create mkfix folder and configure .gitignore
  mkfix -s                       Show the AI skill template
  mkfix --download-skill         Download the skill template file

 ${COLORS.yellow}JSON Configuration Format:${COLORS.reset}
  [
    {
      "path": "relative/path/to/file.js",
      "code": "entire file content"       // Creates or overwrites the file
    }
  ]

  OR

  [
    {
      "path": "relative/path/to/file.js",
      "changes": [
        { "type": "fix",    "line": 10, "old_code": "original", "new_code": "replacement" },
        { "type": "add",    "line": 15, "new_code": "inserted after line 15" },
        { "type": "remove", "line": 20, "old_code": "lines to delete" }
      ]
    }
  ]

 ${COLORS.yellow}Change types:${COLORS.reset}
  fix     Replaces old_code starting at line with new_code
  add     Inserts new_code after the specified line
  remove  Deletes old_code starting at the specified line

 ${COLORS.yellow}Notes:${COLORS.reset}
  - 'code' and 'changes' are mutually exclusive
  - 'code' creates or overwrites the entire file
  - For 'changes', the file must already exist
  - Changes are applied in reverse line order to avoid offset issues
`);
}