# mkfix

A CLI tool to quickly apply AI-suggested code changes from JSON configuration files.

## Overview

`mkfix` is a command-line utility designed to streamline the process of applying code changes suggested by AI assistants. Instead of manually copying and pasting code changes, you can simply place JSON configuration files in the `mkfix` folder and apply them with a single command.

## Installation

### Local Installation

```bash
# Clone or download the project
cd mkfix

# Install dependencies
npm install

# Link the package globally (optional, for easy access)
npm link
```

### Dependencies

- `prompt` - For interactive user input

## Usage

### Basic Commands

```bash
# Start interactive mode to select and apply changes
mkfix

# Apply a specific configuration directly
mkfix -i config-name
mkfix --input config-name

# Create the mkfix folder and add to .gitignore
mkfix -c
mkfix --config

# Display the AI skill template
mkfix -s
mkfix --skill

# Download the AI skill template to current directory
mkfix -ds
mkfix --download-skill

# Show help
mkfix --help
mkfix -h

# Restore backup (reset example/ folder)
npm run restore-backup
```

## Getting Started

### Step 1: Initialize the Configuration Folder

```bash
mkfix -c
```

This command will:
- Create a `mkfix` folder in your current directory
- Add `mkfix/` to your `.gitignore` file (if it exists, or create one)

### Step 2: Create Configuration Files

Place JSON configuration files in the `mkfix` folder. Each file should have a `.json` extension and follow the format described below.

### Step 3: Apply Changes

```bash
# Interactive mode
mkfix

# Or directly specify a configuration
mkfix -i my-fix
```

## JSON Configuration Format

The configuration files contain an array of change objects. Each object specifies a file path and either a complete file content (`code`) or a targeted fix (`fix`).

### Option 1: Complete File Content (`code`)

Use this when you want to create a new file or completely overwrite an existing one.

```json
[
  {
    "path": "src/utils/helper.js",
    "code": "export function formatDate(date) {\n  return new Date(date).toLocaleDateString();\n}\n"
  }
]
```

### Option 2: Targeted Fixes (`fix`)

Use this for making specific line-based replacements. The file must already exist. **Note: `fix` is an array**, allowing multiple fixes per file.

```json
[
  {
    "path": "src/components/Button.tsx",
    "fix": [
      {
        "line": 15,
        "old_code": "const [count, setCount] = useState(0);",
        "new_string": "const [count, setCount] = useState(1);"
      }
    ]
  }
]
```

### Multiple Fixes in the Same File

You can apply multiple fixes to a single file by adding more items to the `fix` array:

```json
[
  {
    "path": "src/config.js",
    "fix": [
      {
        "line": 5,
        "old_code": "const API_URL = 'http://localhost:3000';",
        "new_string": "const API_URL = process.env.API_URL || 'http://localhost:3000';"
      },
      {
        "line": 6,
        "old_code": "const TIMEOUT = 5000;",
        "new_string": "const TIMEOUT = parseInt(process.env.TIMEOUT) || 5000;"
      }
    ]
  }
]
```

### Multiple Files

You can include multiple files in a single configuration:

```json
[
  {
    "path": "src/api/users.js",
    "fix": [
      {
        "line": 25,
        "old_code": "const limit = 10;",
        "new_string": "const limit = 20;"
      }
    ]
  },
  {
    "path": "src/config.js",
    "code": "export const API_URL = 'https://api.example.com';\nexport const TIMEOUT = 5000;\n"
  }
]
```

## Configuration Rules

### Required Properties

| Property | Type | Description |
|----------|------|-------------|
| `path` | string | Relative path to the file from the project root |

### Mutually Exclusive Properties

| Property | Type | Description |
|----------|------|-------------|
| `code` | string | Complete file content (creates or overwrites file) |
| `fix` | array | Array of targeted line replacements (file must exist) |

### Fix Object Structure

Each item in the `fix` array has the following structure:

| Property | Type | Description |
|----------|------|-------------|
| `line` | number | 1-based line number where replacement starts |
| `old_code` | string | Exact code to be replaced (must match file content) |
| `new_string` | string | New code to insert |

### Important Notes

1. **Mutually Exclusive**: `code` and `fix` cannot be used together in the same object
2. **File Existence**: 
   - For `code`: File may or may not exist (will be created or overwritten)
   - For `fix`: File must exist at the specified path
3. **Exact Match**: The `old_code` must match exactly what's in the file, including whitespace
4. **Multi-line Support**: Both `old_code` and `new_string` can span multiple lines using `\n`
5. **Fix is an Array**: The `fix` property is always an array, even for a single fix

## AI Integration

### Using the Skill Template

The `--skill` and `--download-skill` commands provide a skill template that you can give to AI assistants. This template instructs the AI on how to format its responses so they can be directly used with `mkfix`.

```bash
# Display the skill template
mkfix -s

# Download the skill template to a file
mkfix -ds
```

### Workflow with AI Assistants

1. Provide the skill template to your AI assistant
2. Ask the AI to fix an error or make code changes
3. The AI will respond with a JSON configuration
4. Save the JSON to a file in the `mkfix` folder
5. Run `mkfix` to apply the changes

## Restore Backup

The project includes a restore script to reset the example folder to its original state:

```bash
npm run restore-backup
```

This will:
1. Copy the content of `example/backup.js` to `example/index.js`
2. Remove all other files in the `example/` folder
3. Keep only `backup.js` and `index.js`

## Examples

The `mkfix` folder contains several example configurations:

- `fix-simple.json` - Single line replacement
- `fix-multi.json` - Multiple fixes in one file
- `code-create.json` - Create a new file
- `mixed-changes.json` - Combination of fixes and new file creation

## License

MIT
