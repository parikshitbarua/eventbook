# EventBook

A decentralized event management platform built with React, Express, and Ethereum smart contracts.

## Development Setup

This project uses a centralized Husky configuration in the root directory to manage git hooks and lint-staged for both frontend and backend code.

### Git Hooks

The project is configured with the following git hooks:

#### Pre-commit Hook
- Runs `lint-staged` to format and lint files before commit
- Frontend files: ESLint, Stylelint, and Prettier
- Backend files: ESLint and Prettier

#### Commit Message Hook
- Validates commit messages using `commitlint` with conventional commits format

### Lint-staged Configuration

The root `package.json` contains lint-staged rules for:

**Frontend** (`frontend/**/*`):
- `*.{js,jsx,ts,tsx}`: ESLint with auto-fix
- `*.{css,scss,sass}`: Stylelint with auto-fix
- `*`: Prettier formatting

**Backend** (`backend/src/**/*.ts`):
- `*.ts`: Prettier formatting and ESLint with auto-fix

### Project Structure

```
eventbook/
├── .husky/                 # Centralized git hooks
├── frontend/               # React frontend application
├── backend/                # Express backend API
├── contract/               # Ethereum smart contracts
└── package.json           # Root package with husky/lint-staged config
```

### Getting Started

1. Install dependencies in root:
   ```bash
   npm install
   ```

2. Install frontend dependencies:
   ```bash
   cd frontend && npm install
   ```

3. Install backend dependencies:
   ```bash
   cd backend && npm install
   ```

4. The git hooks will automatically run on commit to ensure code quality.

### Commit Message Format

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

Examples:
- `feat(frontend): add dark theme support`
- `fix(backend): resolve authentication bug`
- `docs: update README with setup instructions` 