# @hearth/songs

The song model, shared by the web platform and Hearth Stage.

This package is the reason the repository is a monorepo. A slide on the wall in Stage and a chord
chart in the platform's music stand view resolve the same arrangement with the same function, so the
two cannot disagree about what `V1 C V2 C B C C` means.

**It has no runtime dependencies, and it never will.** It is called from a Next.js server action,
from an Electron main process, from a worker thread reading a ProPresenter file, and from a test.
Anything it imports, all four have to carry, so it imports nothing. A test enforces that.

- [PRD.md section 9.4](../../PRD.md) is the schema's specification.
- [PRD-STAGE.md](../../PRD-STAGE.md) is what Stage does with it.
- Work tracked on [BACKLOG-STAGE.md](../../BACKLOG-STAGE.md) as `STG-n`.

## What lives here

| File | Contents |
|---|---|
| `src/types.ts` | The records from PRD section 9.4, as TypeScript |
| `src/keys.ts` | Musical keys: the ones that appear on a chart, parsed and normalised |
| `src/validate.ts` | Whether a song is well formed, as machine-readable problems |
| `src/fixtures.ts` | Public-domain songs used by the tests, and by Stage's first run |

Storage is deliberately absent. The platform holds these records in Postgres through Drizzle, and
Stage holds them in SQLite. Both map to the same types, and neither mapping belongs in here.
