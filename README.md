# Hearth Stage

A worship presenter. Free, and it runs on its own.

Stage puts words, scripture, media and announcements on the screens in a church
building, and it does it well enough to replace what a church is paying for now.
It installs and presents without signing in to anything.

It is also half of a pair. [Hearth](https://github.com/boluwaji11/ChurchManagement)
is a church management platform given to churches at no cost. A church that uses
both pairs them once, and then this Sunday's plan, the song order, the keys, the
scripture and the team are on the laptop before anyone opens it. No export, and
no file carried across the room.

That is the whole idea, and it is the one thing no other presenter can do,
because no other presenter's maker also runs the church's database.

| | |
|---|---|
| **Specification** | [PRD.md](PRD.md), 21 domains with `ST` requirement IDs |
| **Board** | [BACKLOG.md](BACKLOG.md), every deliverable and its state |
| **What people do** | [docs/journeys.md](docs/journeys.md) |
| **What a presenter has** | [docs/parity.md](docs/parity.md), the inventory against ProPresenter and the others |
| **How it is built** | [docs/architecture.md](docs/architecture.md) |
| **Pairing with Hearth** | [docs/hearth-sync-contract.md](docs/hearth-sync-contract.md) |
| **Licence** | AGPL-3.0 |

## Running it

```
pnpm install
pnpm dev            opens the control surface and an output window
pnpm test
pnpm typecheck
pnpm demo           what the shared packages do, printed to the terminal
pnpm smoke          launches the built app and fails if it dies
```

Node 24, pnpm 10. `pnpm dev` strips `ELECTRON_RUN_AS_NODE` from the environment,
which any editor that is itself an Electron application sets, and which would
otherwise make Electron start as plain Node.

## What is here

```
apps/
  stage              The Electron application: main, preload, control, output
packages/
  songs              The song model, sequence resolution, ChordPro, deck compilation
  stage-store        SQLite on the laptop: the library, backups, migrations
  stage-protocol     What main and its windows say to each other
  colour             OKLCH and WCAG contrast, for the legibility floor
```

`packages/songs` is the song schema from Hearth's PRD section 9.4, implemented
once. The platform consumes it too, so a slide on a wall and a chord chart on a
music stand can never disagree about what `V1 C V2 C B C C` means.

## Where it is up to

Six releases, `S0.1` to `S1.0`, in [BACKLOG.md](BACKLOG.md). Today the shared
domain, the library on disk, and an application that opens two windows and
presents a service are built. There is no installer yet.

**S0.1 to S0.3 need nothing from the management platform.** One release, S0.4,
pairs with it.
