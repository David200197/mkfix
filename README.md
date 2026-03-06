# mkfix

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./black-favicon.svg">
    <source media="(prefers-color-scheme: light)" srcset="./white-favicon.svg">
    <img src="./black-favicon.svg" alt="mkctx logo" width="150">
  </picture>
</p>

A CLI tool to quickly apply AI-suggested code changes from JSON configuration files.

## Overview

`mkfix` is a command-line utility designed to streamline the process of applying code changes suggested by AI assistants. Instead of manually copying and pasting code changes, you can simply place JSON configuration files in the `mkfix` folder and apply them with a single command.

## Installation

```bash
npm install mkfix --global
```

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

Each configuration file is a JSON array. Each element specifies a file `path` and either a complete replacement (`code`) or a list of targeted operations (`changes`).

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

### Option 2: Targeted Changes (`changes`)

Use this for making specific line-based edits. The file must already exist. `changes` is an array of operations, each with a `type` field.

```json
[
  {
    "path": "src/components/Button.tsx",
    "changes": [
      {
        "type": "fix",
        "line": 15,
        "old_code": "original code",
        "new_code": "replacement code"
      },
      { "type": "add", "line": 20, "new_code": "inserted after line 20" },
      { "type": "remove", "line": 25, "old_code": "lines to delete" }
    ]
  }
]
```

### Change Types

| type     | line | old_code | new_code | Behavior                              |
| -------- | ---- | -------- | -------- | ------------------------------------- |
| `fix`    | ✅   | ✅       | ✅       | Replaces `old_code` with `new_code`   |
| `add`    | ✅   | ❌       | ✅       | Inserts `new_code` **after** the line |
| `remove` | ✅   | ✅       | ❌       | Deletes `old_code` starting at line   |

### Examples

#### Fix — replace specific lines

```json
[
  {
    "path": "src/config.js",
    "changes": [
      {
        "type": "fix",
        "line": 9,
        "old_code": "const API_URL = 'http://localhost:3000';",
        "new_code": "const API_URL = process.env.API_URL || 'http://localhost:3000';"
      }
    ]
  }
]
```

#### Add — insert lines after a given line

```json
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
```

#### Remove — delete specific lines

```json
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
```

#### Mixed changes in the same file

```json
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
        "new_code": "const limit = 20;\nconst offset = 0;"
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
```

#### Multiple files

```json
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
    "code": "export const API_URL = 'https://api.example.com';\nexport const TIMEOUT = 5000;\n"
  }
]
```

## Configuration Rules

### Required Properties

| Property | Type   | Description                                     |
| -------- | ------ | ----------------------------------------------- |
| `path`   | string | Relative path to the file from the project root |

### Mutually Exclusive Properties

| Property  | Type   | Description                                        |
| --------- | ------ | -------------------------------------------------- |
| `code`    | string | Complete file content (creates or overwrites file) |
| `changes` | array  | Array of targeted operations (file must exist)     |

### Change Object Structure

| Property   | Type   | Required by     | Description                                       |
| ---------- | ------ | --------------- | ------------------------------------------------- |
| `type`     | string | all             | `"fix"`, `"add"`, or `"remove"`                   |
| `line`     | number | all             | 1-based line number where the operation starts    |
| `old_code` | string | `fix`, `remove` | Exact code to match in the file (inc. whitespace) |
| `new_code` | string | `fix`, `add`    | New code to insert or replace with                |

### Important Notes

1. **Mutually Exclusive**: `code` and `changes` cannot be used together in the same object
2. **File Existence**:
   - For `code`: file may or may not exist (will be created or overwritten)
   - For `changes`: file must already exist
3. **Exact Match**: `old_code` must match exactly what's in the file, including whitespace and indentation
4. **Multi-line**: `old_code` and `new_code` can span multiple lines using `\n`
5. **Order**: changes within a file are applied in reverse line order automatically to avoid offset issues

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

## License

MIT
