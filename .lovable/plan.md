## What I found

The publish failures are most likely from build/runtime boundary issues, not the UI itself:

1. **Server function split risk**
   - `resume.functions.ts`, `jobs.functions.ts`, and `matches.functions.ts` contain schemas/helpers in the same files as `createServerFn` handlers.
   - TanStack Start production builds can fail on `?tss-serverfn-split` when server function files have sibling declarations or server-only imports that are not isolated.

2. **Server-only imports reachable from client graph**
   - `jobs.functions.ts` imports the admin backend client at module scope.
   - Even if it is inside a server function file, production splitting can still be strict about import graphs.

3. **Missing router-level fallback**
   - `src/router.tsx` does not set `defaultErrorComponent`, which can hide or worsen deployment/runtime failures.

4. **Package/dependency state has recently changed**
   - The AI SDK dependencies are now present, but publishing may still be failing because the server-function structure needs cleanup.

## Fix plan

1. **Refactor server function files into thin wrappers**
   - Move Zod schemas, helper types, and helper functions out of `*.functions.ts` into normal shared modules or `*.server.ts` files.
   - Keep `*.functions.ts` files mostly limited to imports plus `createServerFn(...).inputValidator(...).handler(...)` declarations.

2. **Isolate server-only backend/admin logic**
   - Move admin database reads/writes and Firecrawl parsing helpers from `jobs.functions.ts` into a `jobs.server.ts` helper.
   - Keep secrets (`FIRECRAWL_API_KEY`, `LOVABLE_API_KEY`) read only inside server execution paths.

3. **Clean up AI parsing helpers**
   - Move resume/job structured-output schemas to shared schema files if they are safe, or server helper files if only server-side.
   - Import them into handlers in a way that does not confuse TanStack’s server-function splitter.

4. **Add router fallback error handling**
   - Add a `defaultErrorComponent` to `src/router.tsx` so production failures show a controlled error screen and log properly.

5. **Check browser-only resume extraction boundary**
   - Verify `resume-extract.ts` remains dynamically imported only from the profile upload handler and is not pulled into SSR.

6. **Final verification**
   - After implementation, rely on the automatic build/typecheck harness and inspect the preview/server logs for any remaining publish blockers.
   - If another production-only error remains, use the exact new error path to narrow it down rather than guessing.