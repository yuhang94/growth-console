# Contributing to growth-console

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

### Prerequisites

- Node.js 20+ (LTS)
- npm 10+

### Local Development

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. The app runs at `http://localhost:3000` and proxies API requests to `http://localhost:8082`

### Backend Setup

This project depends on the [growth-profile](https://github.com/yuhang94/growth-profile) backend service. Make sure it's running on port 8082 before development.

## How to Contribute

### Reporting Issues

- Use GitHub Issues to report bugs or request features
- Search existing issues before creating a new one
- Use the provided issue templates

### Submitting Changes

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes following the coding conventions below
3. Ensure the build passes: `npm run build`
4. Commit with a clear message:
   ```bash
   git commit -m "feat(profile): add tag category filter"
   ```
5. Push and create a Pull Request

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Scope:** module or page name (e.g., `profile`, `tag-definition`, `layout`)

**Examples:**
- `feat(profile): add tag value batch import`
- `fix(tag-definition): fix enum values not saving correctly`
- `chore: upgrade Element Plus to latest version`

## Coding Conventions

- Use Vue 3 Composition API with `<script setup>` syntax
- All components use PascalCase naming
- TypeScript strict mode — no `any` types
- API functions follow REST semantics: `createXxx`, `updateXxx`, `pageXxx`, `deleteXxx`
- Each backend module has its own API file under `src/api/`
- Use Element Plus components and icons consistently
- SCSS for styling, CSS variables for theming

## Code Review

All submissions require review before merging. Reviewers will check:

- Code quality and TypeScript type safety
- UI consistency with existing pages
- No console errors or warnings
- Responsive behavior

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.
