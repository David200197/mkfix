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

### Option 2: Targeted Fix (`fix`)

Use this for making specific line-based replacements. The file must already exist.

```json
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
```

### Multiple Changes

You can include multiple changes in a single configuration file:

```json
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
    "code": "export const API_URL = 'https://api.example.com';\nexport const TIMEOUT = 5000;\n"
  },
  {
    "path": "src/handlers/error.js",
    "fix": {
      "line": 8,
      "old_code": "console.log(error);",
      "new_code": "console.error(error);\nthrow error;"
    }
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
| `fix` | object | Targeted line replacement (file must exist) |

### Fix Object Structure

| Property | Type | Description |
|----------|------|-------------|
| `line` | number | 1-based line number where replacement starts |
| `old_code` | string | Exact code to be replaced (must match file content) |
| `new_code` | string | New code to insert |

### Important Notes

1. **Mutually Exclusive**: `code` and `fix` cannot be used together in the same object
2. **File Existence**: 
   - For `code`: File may or may not exist (will be created or overwritten)
   - For `fix`: File must exist at the specified path
3. **Exact Match**: The `old_code` must match exactly what's in the file, including whitespace
4. **Multi-line Support**: Both `old_code` and `new_code` can span multiple lines using `\n`

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
3. The AI will respond with properly formatted JSON
4. Save the JSON to a file in the `mkfix` folder
5. Run `mkfix` to apply the changes

## Validation

Before applying any changes, `mkfix` validates the configuration:

1. **Structure Validation**: Ensures the JSON is a valid array with proper object structure
2. **Property Validation**: Checks that required properties exist and have correct types
3. **Mutual Exclusivity**: Verifies that `code` and `fix` are not both present
4. **File Existence**: For `fix` operations, confirms the target file exists
5. **Code Matching**: During `fix` application, verifies that `old_code` matches the actual file content

If any validation fails, the tool will display error messages and exit without making any changes.

## Examples

### Example 1: Creating a New File

**Configuration:** `mkfix/create-helper.json`
```json
[
  {
    "path": "src/utils/date.js",
    "code": "/**\n * Format a date to a localized string\n * @param {Date|string} date\n * @returns {string}\n */\nexport function formatDate(date) {\n  const d = new Date(date);\n  return d.toLocaleDateString('en-US', {\n    year: 'numeric',\n    month: 'long',\n    day: 'numeric'\n  });\n}\n"
  }
]
```

**Command:**
```bash
mkfix -i create-helper
```

### Example 2: Fixing a Bug

**Configuration:** `mkfix/fix-null-check.json`
```json
[
  {
    "path": "src/services/user.service.js",
    "fix": {
      "line": 42,
      "old_code": "return user.name.toUpperCase();",
      "new_code": "return user.name ? user.name.toUpperCase() : 'Unknown';"
    }
  }
]
```

**Command:**
```bash
mkfix -i fix-null-check
```

### Example 3: Multiple Changes

**Configuration:** `mkfix/refactor-api.json`
```json
[
  {
    "path": "src/api/client.js",
    "fix": {
      "line": 5,
      "old_code": "const API_URL = 'http://localhost:3000';",
      "new_code": "const API_URL = process.env.API_URL || 'http://localhost:3000';"
    }
  },
  {
    "path": "src/api/endpoints.js",
    "fix": {
      "line": 12,
      "old_code": "export const USERS_ENDPOINT = '/users';",
      "new_code": "export const USERS_ENDPOINT = '/api/v2/users';"
    }
  },
  {
    "path": "src/api/interceptors.js",
    "code": "export function setupInterceptors(axios) {\n  axios.interceptors.request.use(config => {\n    const token = localStorage.getItem('token');\n    if (token) {\n      config.headers.Authorization = `Bearer ${token}`;\n    }\n    return config;\n  });\n}\n"
  }
]
```

**Command:**
```bash
mkfix -i refactor-api
```

## Error Handling

The tool provides clear error messages for common issues:

- Missing `mkfix` folder
- Empty configuration folder
- Invalid JSON syntax
- Missing required properties
- Type mismatches
- Files not found (for `fix` operations)
- Code mismatch during `fix` application

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | Error (validation failed, file not found, etc.) |

## License

MIT
