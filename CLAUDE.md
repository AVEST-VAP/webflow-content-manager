# Webflow Content Manager - Claude Rules

> Rules and guidelines for Claude AI assistance on this project.

## Project Overview

Webflow Designer Extension for deploying content from Google Sheets/CSV to multiple Webflow pages. Built with React + TypeScript, runs inside Webflow Designer iframe.

## Table of Contents

- [Architecture](#architecture)
- [TypeScript Standards](#typescript-standards)
- [React Patterns](#react-patterns)
- [Code Quality](#code-quality)
- [Testing & Validation](#testing--validation)

---

## Architecture

### Project Structure

```
src/
├── components/       # React components (to be created)
│   ├── Input/       # CSV import and JSON input section
│   ├── Preview/     # Preview and scan results section
│   ├── Progress/    # Scan progress indicators
│   └── Result/      # Deployment results section
├── hooks/           # Custom React hooks (to be created)
│   ├── useDeployment.ts
│   └── useSiteInfo.ts
├── services/        # Business logic
│   ├── deployer.ts  # Core deployment logic
│   └── csvParser.ts # CSV parsing utilities
├── types/           # TypeScript interfaces
│   └── index.ts
├── utils/           # Helper functions
│   └── validation.ts
└── App.tsx          # Main application component
```

### Key Files

- `src/deployer.ts` - Core business logic for scanning and deploying content
- `src/index.tsx` - Main React application entry point
- `src/types.ts` - Shared TypeScript interfaces
- `webflow.json` - Webflow extension manifest

### Webflow Designer API

This extension uses Webflow Designer API v2:
- `webflow.getSiteInfo()` - Get current site information
- `webflow.getAllElements()` - Get all DOM elements on current page
- `webflow.getAllPagesAndFolders()` - Get all pages in the site
- `webflow.switchPage(page)` - Navigate to a specific page
- `element.setTextContent(text)` - Update element text
- `element.getAllCustomAttributes()` - Get custom attributes (data-wording-key, etc.)

---

## TypeScript Standards

### Strict Typing

- **Ban `any`**: Never use `any`. Use precise types or `unknown` with type guards.
- **Explicit interfaces**: Define interfaces for all data structures.
- **Named exports only**: Never use default exports.

```typescript
// ❌ Bad
const [data, setData] = useState<any>(null);
export default App;

// ✅ Good
const [data, setData] = useState<PreviewData | null>(null);
export { App };
```

### Required Interfaces

Always define these types explicitly:

```typescript
// Preview data structure
interface PreviewData {
  single?: boolean;
  changes: Change[];
  missingKeys: string[];
  pagesPreviews?: PagePreview[];
  summary?: PreviewSummary;
}

// Change item
interface Change {
  key: string;
  hasValue: boolean;
  newValue?: string;
}

// Page preview
interface PagePreview {
  pageName: string;
  changes: Change[];
  missingKeys: string[];
  stats: {
    total: number;
    withValue: number;
    missing: number;
  };
}
```

### Type Guards

Use proper type guards instead of `any`:

```typescript
// ❌ Bad
pagesAndFolders?.filter((item: any): item is any => item.type === 'Page')

// ✅ Good
interface WebflowPage {
  type: 'Page' | 'Folder';
  getName: () => Promise<string>;
  getSlug: () => Promise<string>;
}

const isPage = (item: unknown): item is WebflowPage =>
  typeof item === 'object' && item !== null && (item as WebflowPage).type === 'Page';

pagesAndFolders?.filter(isPage)
```

---

## React Patterns

### State Management

- Use `useReducer` for complex state with multiple related variables.
- Avoid more than 5 `useState` calls in a single component.
- Extract state logic into custom hooks.

```typescript
// ❌ Bad - Too many useState
const [step, setStep] = useState('input');
const [siteId, setSiteId] = useState('');
const [siteName, setSiteName] = useState('');
const [loading, setLoading] = useState(false);
// ... 7 more useState calls

// ✅ Good - useReducer
type AppState = {
  step: 'input' | 'preview' | 'result' | 'scan-progress';
  siteId: string;
  siteName: string;
  loading: boolean;
  error: string;
  // ...
};

const [state, dispatch] = useReducer(appReducer, initialState);
```

### Async Effects

Always handle async operations in useEffect properly:

```typescript
// ❌ Bad - Floating promise
useEffect(() => {
  const fetchData = async () => { ... };
  fetchData();
}, []);

// ✅ Good - Proper error handling
useEffect(() => {
  const fetchData = async () => { ... };

  fetchData().catch((err) => {
    console.error('Failed to fetch:', err);
    setError(err.message);
  });
}, []);

// ✅ Also Good - IIFE pattern
useEffect(() => {
  (async () => {
    try {
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  })();
}, []);
```

### Conditional Rendering

Use `condition ? <Component /> : null` pattern:

```typescript
// ❌ Bad
{condition && <Component />}

// ✅ Good
{condition ? <Component /> : null}
```

### Component Splitting

Split components when:
- A component exceeds 200 lines
- A section has distinct responsibility
- Logic can be reused elsewhere

---

## Code Quality

### Comments

- Comments in **English only**
- Only when intent is non-obvious
- Use JSDoc for public functions

```typescript
/**
 * Scans all targeted pages for elements with data-wording-key attributes.
 * @param onProgress - Callback for progress updates
 * @returns Preview data with changes per page
 */
async scanAllPages(
  onProgress?: (status: ScanProgress) => void
): Promise<ScanResult> {
  // ...
}
```

### Error Handling

- Always catch and display errors to users
- Log errors with context for debugging
- Use Error Boundary for React errors

```typescript
try {
  await deployer.deploy();
} catch (err) {
  const message = err instanceof Error ? err.message : 'Unknown error';
  setError(`Deployment failed: ${message}`);
  console.error('Deployment error:', { err, wordingData });
}
```

### Avoid Magic Numbers

```typescript
// ❌ Bad
await new Promise(resolve => setTimeout(resolve, 500));

// ✅ Good
const PAGE_LOAD_DELAY_MS = 500;
await new Promise(resolve => setTimeout(resolve, PAGE_LOAD_DELAY_MS));
```

### Use const Over let

```typescript
// ❌ Bad
let allPages = pagesAndFolders?.filter(...) || [];

// ✅ Good
const allPages = pagesAndFolders?.filter(...) ?? [];
```

---

## Testing & Validation

### Input Validation

Always validate user input:

```typescript
// CSV parsing with proper library
import Papa from 'papaparse';

const parseCSV = (csvText: string): Promise<ParsedRow[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data as ParsedRow[]),
      error: (error) => reject(error)
    });
  });
};
```

### Build Verification

Before committing:

```bash
npm run build      # Must succeed without errors
npm run lint       # Must pass (when configured)
```

### Manual Testing Checklist

Before release:
- [ ] CSV import works with quoted fields
- [ ] Multi-page scan completes
- [ ] Deployment applies all changes
- [ ] Error messages display correctly
- [ ] Progress indicator updates
- [ ] Reset functionality works

---

## Forbidden Patterns

1. **No `any` types** - Use proper interfaces
2. **No default exports** - Use named exports only
3. **No floating promises** - Always handle async errors
4. **No magic numbers** - Use named constants
5. **No console.log in production** - Use proper error handling
6. **No inline styles for layout** - Use CSS classes
7. **No nested ternaries** - Use early returns or separate conditions
8. **No AI signatures** - Never add "Co-Authored-By: Claude" or similar in commits/PRs

---

## Webflow-Specific Guidelines

### Custom Attributes

Standard attributes for content targeting:
- `data-wording-key` - The key matching JSON content
- `data-wording-mode` - Content type (optional, defaults to `text`):
  - `text` - Texte simple (défaut)
  - `link` - Lien (auto-détection : email, téléphone, URL externe, page interne)
  - `placeholder` - Placeholder pour les inputs de formulaire

#### Exemples

**Texte simple (mode par défaut) :**
```html
<p data-wording-key="home.hero.title">Mon titre</p>
```

**Lien (auto-détection) :**
```html
<a data-wording-key="home.cta.link" data-wording-mode="link">Mon lien</a>
```
- Email (`contact@trybe.fr`) → lien mailto
- Téléphone (`+33 6 12 34 56 78`) → lien tel
- URL externe (`https://...`) → lien externe (nouvel onglet automatique)
- Chemin relatif (`/page`) → lien relatif
- Nom de page (`Contact`) → lien interne Webflow

**Placeholder :**
```html
<input data-wording-key="contact.email" data-wording-mode="placeholder" />
```

**Bouton avec lien + texte (structure recommandée) :**
```
Link Block (data-wording-key="cta.link" data-wording-mode="link")
  └── Paragraph (data-wording-key="cta.text")
```

### SEO Metadata

Keys with `_seo.` prefix set page metadata via the Webflow API :
- `home._seo.title` → `page.setTitle("...")`
- `home._seo.description` → `page.setDescription("...")`

These keys are handled automatically during scan/deploy and don't appear as "unused keys".

### Page Targeting

Keys with dot notation target specific pages:
- `home.hero.title` → targets "Home" page, section "hero"
- `about.team.description` → targets "About" page, section "team"
- `home._seo.title` → targets "Home" page SEO metadata

### API Rate Limiting

- Add delay between page switches (500ms minimum)
- Don't scan more than 50 pages at once
- Handle API errors gracefully

---

## Clean Code Principles

Every piece of code must follow DRY, Separation of Concerns, and clean code practices.

### DRY (Don't Repeat Yourself)

- Never duplicate logic. If code appears more than once, extract it into a shared utility, hook, or component.
- Before creating anything new, verify it doesn't already exist in `hooks/`, `utils/`, `services/`, or `components/`.
- Centralize constants, enums, and type definitions — never scatter them across files.

### Separation of Concerns

- Each file, function, and component must have a single, clear responsibility.
- Keep business logic out of components — move it into hooks, stores, or utility functions.
- UI rendering, state management, and side effects must live in separate layers.

### Clean Code

- Functions and variables must have descriptive, intention-revealing names.
- Functions should be short and do one thing.
- Prefer early returns over deeply nested conditionals.
- No dead code, no commented-out code, no unused imports.
- Fix root causes, not symptoms. Never layer workarounds.

---

## Claude Code Specific Rules

### Commits

- **Never** add "Co-Authored-By: Claude" or similar AI signatures in commits.
- Atomic commits with single-line messages.
- Format: `type(scope): description` (e.g., `feat(seo): add page metadata support`).
- Common types: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`.

### Branches

- Format: `{user}/{short-description}` (e.g., `fawsy/duplicate-key-detection`).
- Short description must give enough context without looking up a ticket.
- Use dashes `-` to separate words.

### Pull Requests

- **Never** add footers like "Generated with Claude Code".
- Required structure: `## Quoi` / `## Changements` / `## Tests` / `## Notes`.

### MCP (Model Context Protocol)

#### GitHub MCP

- **Always** use MCP GitHub tools instead of `gh` CLI for GitHub operations when available.
- Check PR status, comments, and checks directly via MCP.

### Claude Code Tools

| Need          | Use        | Avoid                          |
| ------------- | ---------- | ------------------------------ |
| Read a file   | `Read`     | `cat`, `head`, `tail` via Bash |
| Search code   | `Grep`     | `grep`, `rg` via Bash          |
| Find files    | `Glob`     | `find`, `ls` via Bash          |
| Edit a file   | `Edit`     | `sed`, `awk` via Bash          |
| Create a file | `Write`    | `echo >`, `cat <<EOF` via Bash |
| GitHub info   | MCP GitHub | `gh` CLI via Bash              |

Bash is reserved for: git commands, npm commands, and system commands requiring shell execution.

### Checklists

#### Before each commit

- [ ] No `any` types
- [ ] Named exports only (no `default export`)
- [ ] No floating promises
- [ ] No magic numbers — use named constants
- [ ] `npm run build` passes without errors
- [ ] No AI signatures in commit message

#### Before each PR

- [ ] PR template followed
- [ ] No "Generated with Claude Code" footer
- [ ] Modified files reviewed
- [ ] TypeScript checks pass
- [ ] CHANGELOG.md updated

---

## Changelog

All changes must be documented in `CHANGELOG.md` at the root of the repository. See the file for format and conventions.

---

## Quick Reference

### Commands

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run lint       # Run linter (when configured)
```

### File Naming

- Components: `PascalCase.tsx` (e.g., `InputSection.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useDeployment.ts`)
- Utilities: `camelCase.ts` (e.g., `validation.ts`)
- Types: `types.ts` or `index.ts` in types folder

### Import Order

1. React and external libraries
2. Internal components
3. Hooks
4. Utils and services
5. Types
6. Styles

```typescript
import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

import { InputSection } from './components/Input/InputSection';
import { useDeployment } from './hooks/useDeployment';
import { validateWordingData } from './utils/validation';
import type { WordingData, DeploymentReport } from './types';
import './styles.css';
```
