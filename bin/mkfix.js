#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const prompt = require('prompt');

// Configuration
const MKFIX_FOLDER = 'mkfix';
const SKILL_FILENAME = 'mkfix-skill.md';

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

/**
 * Print colored message
 */
function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
${colors.cyan}mkfix${colors.reset} - A CLI tool to quickly apply AI-suggested code changes

${colors.yellow}Usage:${colors.reset}
  mkfix                          Start interactive mode to select and apply changes
  mkfix [options]                Run with specific options

${colors.yellow}Options:${colors.reset}
  -i, --input <name>             Skip selection and apply the specified config file directly
  -c, --config                   Create the mkfix folder and add it to .gitignore
  -s, --skill                    Print the AI skill template for generating fix configurations
  -ds, --download-skill          Download the AI skill template to current directory
  -h, --help                     Show this help message

${colors.yellow}Examples:${colors.reset}
  mkfix                          Interactive mode
  mkfix -i fix-bug-123           Apply fix-bug-123.json directly
  mkfix -c                       Create mkfix folder and configure .gitignore
  mkfix -s                       Show the AI skill template
  mkfix --download-skill         Download the skill template file

${colors.yellow}JSON Configuration Format:${colors.reset}
  The JSON files in the mkfix folder should have the following structure:
  
  [
    {
      "path": "relative/path/to/file.js",
      "code": "entire file content"  // For creating/overwriting files
    }
  ]
  
  OR
  
  [
    {
      "path": "relative/path/to/file.js",
      "fix": {                       // For targeted line replacements
        "line": 10,
        "old_code": "original code",
        "new_code": "replacement code"
      }
    }
  ]

${colors.yellow}Notes:${colors.reset}
  - 'code' and 'fix' are mutually exclusive in each configuration item
  - 'code' creates or overwrites the entire file
  - 'fix' performs a targeted replacement starting at the specified line
  - For 'fix', the file must already exist at the specified path
`);
}

/**
 * Get the AI skill template content
 */
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

OR for targeted fixes:

\`\`\`json
[
  {
    "path": "relative/path/to/file.ext",
    "fix": {
      "line": <line_number>,
      "old_code": "exact code to replace",
      "new_code": "new code to insert"
    }
  }
]
\`\`\`

## Rules

1. **Mutually Exclusive**: Use either \`code\` OR \`fix\`, never both in the same object
2. **Path**: Always use relative paths from the project root
3. **code**: Use when creating new files or completely rewriting existing ones
4. **fix**: Use for targeted changes - the file must already exist
5. **old_code**: Must match the exact code in the file at the specified line (including whitespace)
6. **line**: 1-based line number where the replacement starts
7. **Multiple Changes**: Use multiple objects in the array for multiple files or changes

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

### Fixing a specific line:

\`\`\`json
[
  {
    "path": "src/components/Button.tsx",
    "fix": {
      "line": 15,
      "old_code": "const [count, setCount] = useState(0);",
      "new_code": "const [count, setCount] = useState(1);"
    }
  }
]
\`\`\`

### Multiple changes:

\`\`\`json
[
  {
    "path": "src/api/users.js",
    "fix": {
      "line": 25,
      "old_code": "const limit = 10;",
      "new_code": "const limit = 20;"
    }
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
- The \`old_code\` must match exactly what's in the file for the fix to work
- You can apply multiple fixes to the same file by using separate objects with the same path
`;
}

/**
 * Validate a single configuration item
 */
function validateConfigItem(item, index) {
  const errors = [];

  // Check if path exists
  if (!item || typeof item !== 'object') {
    errors.push(`Item ${index}: Must be an object`);
    return errors;
  }

  if (!item.path || typeof item.path !== 'string') {
    errors.push(`Item ${index}: 'path' must be a non-empty string`);
  }

  // Check for mutual exclusivity of code and fix
  const hasCode = 'code' in item;
  const hasFix = 'fix' in item;

  if (!hasCode && !hasFix) {
    errors.push(`Item ${index}: Must have either 'code' or 'fix' property`);
  }

  if (hasCode && hasFix) {
    errors.push(`Item ${index}: Cannot have both 'code' and 'fix' properties - they are mutually exclusive`);
  }

  // Validate code property
  if (hasCode && typeof item.code !== 'string') {
    errors.push(`Item ${index}: 'code' must be a string`);
  }

  // Validate fix property
  if (hasFix) {
    if (!item.fix || typeof item.fix !== 'object') {
      errors.push(`Item ${index}: 'fix' must be an object`);
    } else {
      if (typeof item.fix.line !== 'number' || item.fix.line < 1) {
        errors.push(`Item ${index}: 'fix.line' must be a positive number`);
      }
      if (typeof item.fix.old_code !== 'string') {
        errors.push(`Item ${index}: 'fix.old_code' must be a string`);
      }
      if (typeof item.fix.new_code !== 'string') {
        errors.push(`Item ${index}: 'fix.new_code' must be a string`);
      }
    }
  }

  return errors;
}

/**
 * Validate the entire configuration
 */
function validateConfig(config) {
  const errors = [];

  if (!Array.isArray(config)) {
    errors.push('Configuration must be an array');
    return errors;
  }

  if (config.length === 0) {
    errors.push('Configuration array cannot be empty');
    return errors;
  }

  config.forEach((item, index) => {
    const itemErrors = validateConfigItem(item, index);
    errors.push(...itemErrors);
  });

  return errors;
}

/**
 * Check if file exists for fix operations
 */
function checkFixFileExists(config, rootPath) {
  const errors = [];

  config.forEach((item, index) => {
    if (item.fix) {
      const filePath = path.join(rootPath, item.path);
      if (!fs.existsSync(filePath)) {
        errors.push(`Item ${index}: File does not exist at path '${item.path}' (required for fix operation)`);
      }
    }
  });

  return errors;
}

/**
 * Apply code change (create or overwrite file)
 */
function applyCodeChange(filePath, code) {
  const dir = path.dirname(filePath);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, code, 'utf8');
}

/**
 * Apply fix change (replace code at specific line)
 */
function applyFixChange(filePath, fix) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  const startIndex = fix.line - 1; // Convert to 0-based index
  
  // Get the lines that should match old_code
  const oldCodeLines = fix.old_code.split('\n');
  const actualLines = lines.slice(startIndex, startIndex + oldCodeLines.length);
  const actualCode = actualLines.join('\n');

  // Verify that the old_code matches
  if (actualCode !== fix.old_code) {
    throw new Error(
      `Code mismatch at line ${fix.line}.\n` +
      `Expected:\n${fix.old_code}\n` +
      `Found:\n${actualCode}`
    );
  }

  // Replace the lines
  const newCodeLines = fix.new_code.split('\n');
  lines.splice(startIndex, oldCodeLines.length, ...newCodeLines);

  // Write back to file
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

/**
 * Apply all changes from configuration
 */
function applyChanges(config, rootPath) {
  const results = [];

  config.forEach((item, index) => {
    const filePath = path.join(rootPath, item.path);
    
    try {
      if (item.code !== undefined) {
        applyCodeChange(filePath, item.code);
        results.push({
          index,
          path: item.path,
          type: 'code',
          status: 'success',
          message: `File ${fs.existsSync(filePath) ? 'updated' : 'created'} successfully`
        });
      } else if (item.fix) {
        applyFixChange(filePath, item.fix);
        results.push({
          index,
          path: item.path,
          type: 'fix',
          status: 'success',
          message: `Fixed lines starting at ${item.fix.line}`
        });
      }
    } catch (error) {
      results.push({
        index,
        path: item.path,
        type: item.code !== undefined ? 'code' : 'fix',
        status: 'error',
        message: error.message
      });
    }
  });

  return results;
}

/**
 * Create mkfix folder and add to .gitignore
 */
function createConfig() {
  const rootPath = process.cwd();
  const mkfixPath = path.join(rootPath, MKFIX_FOLDER);
  const gitignorePath = path.join(rootPath, '.gitignore');

  // Create mkfix folder
  if (!fs.existsSync(mkfixPath)) {
    fs.mkdirSync(mkfixPath);
    log(`✓ Created '${MKFIX_FOLDER}' folder`, 'green');
  } else {
    log(`'${MKFIX_FOLDER}' folder already exists`, 'yellow');
  }

  // Add to .gitignore
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
    
    if (!gitignoreContent.includes(MKFIX_FOLDER)) {
      // Add newline if file doesn't end with one
      const newline = gitignoreContent.endsWith('\n') ? '' : '\n';
      fs.appendFileSync(gitignorePath, `${newline}${MKFIX_FOLDER}/\n`, 'utf8');
      log(`✓ Added '${MKFIX_FOLDER}/' to .gitignore`, 'green');
    } else {
      log(`'${MKFIX_FOLDER}' is already in .gitignore`, 'yellow');
    }
  } else {
    // Create .gitignore with mkfix entry
    fs.writeFileSync(gitignorePath, `${MKFIX_FOLDER}/\n`, 'utf8');
    log(`✓ Created .gitignore with '${MKFIX_FOLDER}/' entry`, 'green');
  }
}

/**
 * Download skill file
 */
function downloadSkill() {
  const skillContent = getSkillTemplate();
  const downloadPath = path.join(process.cwd(), SKILL_FILENAME);
  
  fs.writeFileSync(downloadPath, skillContent, 'utf8');
  log(`✓ Skill template downloaded to '${SKILL_FILENAME}'`, 'green');
}

/**
 * Get available JSON configuration files
 */
function getConfigFiles(mkfixPath) {
  if (!fs.existsSync(mkfixPath)) {
    return [];
  }

  return fs.readdirSync(mkfixPath)
    .filter(file => file.endsWith('.json'))
    .map(file => file.replace('.json', ''));
}

/**
 * Main interactive mode
 */
async function interactiveMode() {
  const rootPath = process.cwd();
  const mkfixPath = path.join(rootPath, MKFIX_FOLDER);

  // Check if mkfix folder exists
  if (!fs.existsSync(mkfixPath)) {
    log(`\n✗ The '${MKFIX_FOLDER}' folder does not exist in the current directory.`, 'red');
    log(`\n  Run 'mkfix -c' to create the folder and set up configuration.`, 'cyan');
    log(`  Then place your JSON configuration files in the '${MKFIX_FOLDER}' folder.\n`);
    process.exit(1);
  }

  // Get available config files
  const configFiles = getConfigFiles(mkfixPath);

  if (configFiles.length === 0) {
    log(`\n✗ No JSON configuration files found in the '${MKFIX_FOLDER}' folder.`, 'red');
    log(`\n  Place your JSON configuration files in the '${MKFIX_FOLDER}' folder and try again.\n`);
    process.exit(1);
  }

  // Prompt user to select a config
  log('\nAvailable configurations:', 'cyan');
  configFiles.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file}`);
  });

  prompt.start();
  prompt.message = '';
  prompt.delimiter = '';

  const schema = {
    properties: {
      selection: {
        description: `\n${colors.white}Select a configuration (1-${configFiles.length}):${colors.reset}`,
        type: 'number',
        required: true,
        conform: function(value) {
          return value >= 1 && value <= configFiles.length;
        },
        message: `Please enter a number between 1 and ${configFiles.length}`
      }
    }
  };

  try {
    const result = await new Promise((resolve, reject) => {
      prompt.get(schema, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

    const selectedConfig = configFiles[result.selection - 1];
    await processConfig(selectedConfig, mkfixPath, rootPath);

  } catch (err) {
    log('\nOperation cancelled.', 'yellow');
    process.exit(0);
  }
}

/**
 * Process a configuration file
 */
async function processConfig(configName, mkfixPath, rootPath) {
  const configPath = path.join(mkfixPath, `${configName}.json`);

  log(`\nLoading configuration: ${configName}`, 'cyan');

  // Read and parse JSON
  let config;
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(content);
  } catch (err) {
    log(`✗ Error reading configuration file: ${err.message}`, 'red');
    process.exit(1);
  }

  // Validate configuration
  log('Validating configuration...', 'cyan');
  const validationErrors = validateConfig(config);

  if (validationErrors.length > 0) {
    log('\n✗ Configuration validation failed:', 'red');
    validationErrors.forEach(err => log(`  - ${err}`, 'red'));
    process.exit(1);
  }

  // Check if files exist for fix operations
  const fileErrors = checkFixFileExists(config, rootPath);
  if (fileErrors.length > 0) {
    log('\n✗ File existence check failed:', 'red');
    fileErrors.forEach(err => log(`  - ${err}`, 'red'));
    process.exit(1);
  }

  log('✓ Configuration is valid', 'green');

  // Apply changes
  log('\nApplying changes...', 'cyan');
  const results = applyChanges(config, rootPath);

  // Print results
  console.log('');
  let successCount = 0;
  let errorCount = 0;

  results.forEach(result => {
    if (result.status === 'success') {
      successCount++;
      log(`  ✓ [${result.index}] ${result.path}: ${result.message}`, 'green');
    } else {
      errorCount++;
      log(`  ✗ [${result.index}] ${result.path}: ${result.message}`, 'red');
    }
  });

  console.log('');
  log(`Summary: ${successCount} successful, ${errorCount} failed`, 
      errorCount > 0 ? 'yellow' : 'green');
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const result = {
    help: false,
    config: false,
    skill: false,
    downloadSkill: false,
    input: null
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--config' || arg === '-c') {
      result.config = true;
    } else if (arg === '--skill' || arg === '-s') {
      result.skill = true;
    } else if (arg === '--download-skill' || arg === '-ds') {
      result.downloadSkill = true;
    } else if (arg === '--input' || arg === '-i') {
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        result.input = args[i + 1];
        i++;
      } else {
        log('Error: --input requires a configuration name', 'red');
        process.exit(1);
      }
    }
  }

  return result;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  // Handle help
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Handle config creation
  if (options.config) {
    createConfig();
    process.exit(0);
  }

  // Handle skill display
  if (options.skill) {
    console.log(getSkillTemplate());
    process.exit(0);
  }

  // Handle skill download
  if (options.downloadSkill) {
    downloadSkill();
    process.exit(0);
  }

  // Handle direct input
  if (options.input) {
    const rootPath = process.cwd();
    const mkfixPath = path.join(rootPath, MKFIX_FOLDER);

    if (!fs.existsSync(mkfixPath)) {
      log(`\n✗ The '${MKFIX_FOLDER}' folder does not exist.`, 'red');
      log(`  Run 'mkfix -c' to create it first.\n`);
      process.exit(1);
    }

    await processConfig(options.input, mkfixPath, rootPath);
    process.exit(0);
  }

  // Run interactive mode
  await interactiveMode();
}

// Run main function
main().catch(err => {
  log(`\nUnexpected error: ${err.message}`, 'red');
  process.exit(1);
});
