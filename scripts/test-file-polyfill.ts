// scripts/test-file-polyfill.ts

// 1. Check if File is defined globally (it shouldn't be yet in Node 18, or if it is already patched)
const initialFile = (global as any).File;
console.log('Initial global.File:', typeof initialFile);

// 2. Import the worker to trigger the side-effect polyfill
// Note: We need to use dynamic import or require because this is a module setting
// But since we are in a module project (type: module in package.json), we use import.
// However, the side effect in worker.ts runs on import.

try {
    // We need to simulate the environment variables for worker.ts to not crash immediately
    process.env.WORKER_NAME = 'test-worker';
    process.env.DATABASE_NAME = 'test-db';

    // We don't want the worker to actually run and connect to DB, 
    // but looking at worker.ts:
    // if (isWorker) { runWorker(); }
    // isWorker checks process.env.WORKER_NAME.
    // So if we set WORKER_NAME, it WILL try to run.

    // To avoid running the worker logic (connecting to DB etc), we should probably 
    // import it in a way that doesn't trigger runWorker, OR just trust that 
    // the side effect happens.

    // Actually, `worker.ts` has:
    // if (isWorker) { runWorker(); }

    // If we want to test the polyfill logic WITHOUT running the worker, we can't easily import `worker.ts` 
    // because it executes `runWorker` if `WORKER_NAME` is set.
    // If `WORKER_NAME` is NOT set, `isWorker` is false, and `runWorker` is NOT called.
    // BUT the polyfill is at the top level, so it SHOULD execute regardless of `isWorker`.

    delete process.env.WORKER_NAME; // Ensure it's not set

    await import('../src/sync/worker.js'); // Use .js extension for compiled output or source if using ts-node

    const patchedFile = (global as any).File;
    console.log('Patched global.File:', typeof patchedFile);

    if (typeof patchedFile === 'function') {
        const file = new patchedFile(['content'], 'test.txt', { type: 'text/plain' });
        console.log('File created successfully:');
        console.log(' - Name:', file.name);
        console.log(' - Size:', file.size);
        console.log(' - Type:', file.type);
        console.log(' - Instance of Blob:', file instanceof Blob);

        if (file.name === 'test.txt' && file instanceof Blob) {
            console.log('SUCCESS: File polyfill is working.');
            process.exit(0);
        } else {
            console.error('FAILURE: File object checks failed.');
            process.exit(1);
        }
    } else {
        console.error('FAILURE: global.File is still undefined.');
        process.exit(1);
    }

} catch (err) {
    console.error('ERROR during test:', err);
    process.exit(1);
}
