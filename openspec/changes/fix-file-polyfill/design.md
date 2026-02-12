# Design: File Polyfill Injection

## Context
The `jira.js` library uses `new File([blob], filename)` internally when processing attachments. Node.js 18 does not have `File` in the global scope.

## Architecture
We will inject the polyfill at the entry point of the worker process, ensuring it is available before any `jira.js` code runs.

### Polyfill Logic
```typescript
if (typeof (global as any).File === 'undefined') {
  class File extends Blob {
    name: string;
    lastModified: number;

    constructor(sources: Array<any>, name: string, options?: any) {
      super(sources, options);
      this.name = name;
      this.lastModified = options?.lastModified || Date.now();
    }
  }
  (global as any).File = File;
}
```

## Alternatives
1. **Upgrade to Node 20:** This would natively solve the issue but might require a larger infrastructure change (Docker images, server updates). A polyfill is a faster, lower-risk fix for the current environment.
2. **Patch `jira.js`:** Trying to mock the library specifically is brittle. Global polyfill is standard practice for missing web APIs in Node.
