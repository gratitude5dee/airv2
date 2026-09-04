## 5. Budgets

The Build Service enforces these; `scripts/verify.ts` enforces them on the Kit itself, so a component listed above already fits.

| Budget | Limit | Where it is enforced |
| --- | --- | --- |
| JS, `lite` set (everything marked `lite="true"` bundled together, gzip) | 300 KiB | verify.ts, Build Service |
| JS, hard (any app, gzip) | 1 MiB | Build Service |
| CSS (gzip) | 200 KiB | verify.ts, Build Service |
| One image | 2 MiB | Build Service (`validateBundle`) |
| Apps API state, one resource | 256 KiB | `PUT /api/apps/v1/state` (413) |
| Functions module | 1 MiB | `lib/functions/deploy.ts` |
| Functions request | 50 CPU-ms, 20 subrequests | Dispatcher |

Weights in the catalog are gzipped KiB after esbuild with react/react-dom and the shared vendor packages external, so they add. `jsFull` in `meta.json` is the cost when the app has nothing but React.
