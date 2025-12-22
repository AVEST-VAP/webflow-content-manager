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

---

## Webflow-Specific Guidelines

### Custom Attributes

Standard attributes for content targeting:
- `data-wording-key` - The key matching JSON content
- `data-wording-mode` - Content type: `text`, `html`, `attr:href`, `attr:src`, `attr:alt`

### Page Targeting

Keys with dot notation target specific pages:
- `home.hero.title` → targets "Home" page
- `about.team.description` → targets "About" page

### API Rate Limiting

- Add delay between page switches (500ms minimum)
- Don't scan more than 50 pages at once
- Handle API errors gracefully

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
