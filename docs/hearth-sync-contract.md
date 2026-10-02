# Hearth Stage sync contract, v1

The versioned interface between the platform and Hearth Stage. [PRD.md section 9.6](../PRD.md)
settles that this contract exists and that it is a Phase 1 deliverable. This document is the
specification both sides build against.

| | |
|---|---|
| **Server side** | Platform release 0.4, requirements R11.14 and R12.13. Built on the platform board as `HRT-n`. |
| **Client side** | Stage release S0.4, requirements ST1.3 to ST1.10 and ST4.x. Built on the Stage board as `STG-n`. |
| **Optional** | **Pairing is an upgrade.** Stage holds its own library and presents a full service without ever reaching this API. Nothing in Stage releases S0.1 to S0.3 touches it. |
| **Shape of the data** | [PRD.md section 9.4](../PRD.md) is the source of truth for the song schema. This document does not redefine it. |

## The one idea

**One writer per record.**

Stage holds two kinds of song, and the difference is which store the row lives in
([stage-architecture.md](stage-architecture.md), "Local store").

| Origin | Writer | Over this interface |
|---|---|---|
| `local` | Stage | Typed in or imported on the laptop. Invisible to the platform until the operator promotes it. |
| `hearth` | The platform | Pulled through this interface, read-only in Stage, rebuilt by any resync. |

Everything else in this document follows from that. Stage never sends an edit to a record it pulled,
so there is no conflict resolution to get wrong and no path by which a laptop in a cupboard corrupts a
church's library. The synced store is disposable and is always rebuildable from the platform, and
rebuilding it cannot touch the library the church typed in.

Two writes go upward, and both are additive:

- **`song_usage`**, append-only and idempotent, so pushing the same row twice is harmless.
- **A promoted song**, inserted once, on the operator's explicit action, after a duplicate check.
  After promotion the platform owns it and Stage treats it as `hearth`.

There is no merge algorithm anywhere in this contract, and any future requirement that would need one
is refused.

## Transport

- REST over HTTPS, under `/api/stage/v1`.
- JSON bodies, `snake_case` field names, matching the database column names in PRD section 9.4.
- Timestamps are RFC 3339 with an offset, generated server side. Stage never sends a timestamp it
  authored for ordering purposes, because a church laptop's clock is not trustworthy.
- `Accept-Encoding: gzip` expected. Payloads are mostly text and compress by roughly 80%.
- Every response carries `X-Hearth-Stage-Api: 1`. A client receiving a different major version stops
  syncing and says so, and **keeps serving its cache**.

### Versioning

The major version is in the path. A breaking change is `/api/stage/v2` running alongside v1 for at
least twelve months, because a church with a laptop that has not been updated in a year still has to
run a service. Additive fields are not breaking and are ignored by older clients.

## Authentication

### Pairing

```
POST /api/stage/v1/devices
{ "pairing_code": "K7M2QX", "device_name": "Media Desk iMac", "platform": "darwin", "app_version": "0.2.0" }

201
{ "device_token": "<opaque, 64 bytes, base64url>",
  "device_id": "uuid",
  "tenant": { "id": "uuid", "name": "Grace Community Church", "timezone": "America/Chicago" },
  "campus_id": "uuid | null" }
```

- The pairing code is generated in the platform UI by an Owner or Admin. Six characters from an
  unambiguous alphabet, excluding `0`, `O`, `1`, `I`, `L`. Single use, fifteen minute expiry (ST1.4).
- The device token is opaque, long lived, and stored in the operating system keychain (ST1.5).
- Rate limited hard on the pairing path. A wrong code is a 404 with no information about which part
  was wrong.

### Every other request

```
Authorization: Bearer <device_token>
```

### Scope

The device token resolves to a **device principal**, which is not a user and has no role in the
platform's role table. Its permissions are fixed and enforced server side (ST1.8):

| Scope | Entities |
|---|---|
| Read | services and occurrences, plans, plan items, item notes, songs, song sections, arrangements, arrangement media metadata, resolved scripture text, themes, and the names and positions of people scheduled to the synced services |
| Write | `song_usage`, and a promoted song with its sections and arrangements |
| Refused | people, households, giving, check-in, pipelines, forms, pastoral notes, audit log, settings, and every other entity in the platform |

The team roster read is **names and positions only**. A Stage device never receives a phone number, an
email address, an address, a date of birth, a giving record, or a note of any class. This is the
field-level permission rule from R1.5 applied to a device principal, and it is enforced in the query
layer rather than by selecting columns in the route handler.

### Revocation

A revoked device receives `401` with `{ "error": "device_revoked" }` on its next sync. The client
stops syncing, says so on the control surface, and **carries on serving its cache** (ST1.7).
Revocation is an administrative act, and it is never allowed to stop a service that has already
started.

## The sync model

Delta sync by an opaque cursor over a monotonic change sequence.

Every synced table carries a `change_seq bigint` assigned from a single sequence per tenant, bumped on
every insert and update by the same trigger that writes the audit entry. The cursor is that number,
opaque to the client.

```
GET /api/stage/v1/changes?cursor=<opaque>&limit=500

200
{ "cursor": "<new opaque cursor>",
  "has_more": true,
  "changes": [
    { "entity": "song",        "id": "uuid", "op": "upsert", "change_seq": 81422 },
    { "entity": "song_section","id": "uuid", "op": "upsert", "change_seq": 81423 },
    { "entity": "plan",        "id": "uuid", "op": "tombstone", "change_seq": 81424 }
  ] }
```

- Omitting `cursor` means a full enumeration, which happens once on pairing.
- `has_more` true means call again with the returned cursor. The client loops until it is false.
- **A cursor is only advanced after the referenced bodies have been fetched and committed to the local
  database in one transaction.** A crash mid-sync therefore replays, and replay is safe because every
  operation is an upsert.
- `op` is `upsert` or `tombstone`. **There is no delete**, carried from the platform's archive rule.
  A tombstone means archived, out of scope, or no longer within the sync window.

### Why a cursor rather than `updated_at`

Two rows updated in the same millisecond, a clock adjusted on the server, and pagination across a
timestamp boundary all produce silently missed rows. A per-tenant sequence has none of those
failure modes, and it costs one column.

### The sync window

Stage does not sync a church's entire history. It syncs:

- **Services** from seven days ago to twenty-eight days ahead, with their plans and items (ST4.10).
- **Songs** referenced by any plan in that window, plus every song in the library, because the whole
  library is what makes ST5.8 possible and a 2,000 song library is a few megabytes of text.
- **Arrangement media metadata** for arrangements in the window. The files themselves are fetched
  separately and on demand.
- **Themes** for the tenant, all of them.

A service leaving the window is tombstoned. A client that wants a wider window asks for one:
`?window_days_back=90`, bounded server side.

## Fetching bodies

```
GET /api/stage/v1/songs?ids=<uuid>,<uuid>,...        up to 100 ids
GET /api/stage/v1/plans?ids=<uuid>,...               up to 50 ids
GET /api/stage/v1/themes
```

A song comes back whole, with its sections and arrangements nested, because a song without its
sections is not a thing Stage can use and two round trips to assemble one is waste.

```json
{
  "songs": [{
    "id": "uuid",
    "title": "Great Is Thy Faithfulness",
    "alternate_titles": [],
    "author": "Thomas O. Chisholm",
    "composer": "William M. Runyan",
    "publisher": null,
    "year": 1923,
    "ccli_number": "18723",
    "copyright_line": "Public Domain",
    "is_public_domain": true,
    "themes": ["faithfulness", "trust"],
    "tempo_bpm": 76,
    "time_signature": "3/4",
    "typical_duration_seconds": 240,
    "default_key": "D",
    "primary_language": "en",
    "last_used_at": "2026-09-21T10:35:00-05:00",
    "change_seq": 81422,
    "sections": [{
      "id": "uuid",
      "section_type": "verse",
      "label": "V1",
      "sort_order": 0,
      "lines": ["Great is Thy faithfulness, O God my Father",
                "There is no shadow of turning with Thee"],
      "language": "en",
      "translation_of": null
    }],
    "arrangements": [{
      "id": "uuid",
      "name": "Sunday 2026",
      "key": "D",
      "tempo_bpm": 76,
      "sequence": ["V1", "C", "V2", "C", "V3", "C", "C"],
      "chordpro": "{title: Great Is Thy Faithfulness}\n[D]Great is Thy [G]faithfulness...",
      "is_default": true,
      "media": [{
        "id": "uuid",
        "kind": "reference_audio",
        "content_hash": "sha256:...",
        "byte_size": 4821003,
        "duration_seconds": 243,
        "mime_type": "audio/mpeg"
      }]
    }]
  }]
}
```

A plan comes back with its items, and each item carries everything needed to present it with no
further lookup.

```json
{
  "plans": [{
    "id": "uuid",
    "service_occurrence_id": "uuid",
    "title": "Sunday Morning",
    "starts_at": "2026-10-04T10:30:00-05:00",
    "campus_id": "uuid | null",
    "series": "The Kingdom",
    "theme": null,
    "revision": 14,
    "change_seq": 81500,
    "items": [{
      "id": "uuid",
      "sort_order": 3,
      "item_type": "song",
      "title": "Great Is Thy Faithfulness",
      "duration_seconds": 300,
      "description": null,
      "song_id": "uuid",
      "arrangement_id": "uuid",
      "key_override": "E",
      "notes": [
        { "scope": "global",   "position": null,    "body": "Start a cappella" },
        { "scope": "position", "position": "Drums", "body": "In on the second verse" }
      ],
      "attachments": [
        { "id": "uuid", "kind": "chart_pdf", "content_hash": "sha256:...", "byte_size": 182344 }
      ]
    }, {
      "id": "uuid",
      "sort_order": 4,
      "item_type": "scripture",
      "title": "Matthew 5:1-12",
      "duration_seconds": 180,
      "scripture": {
        "reference": "Matthew 5:1-12",
        "translation": "NIV",
        "verses": [{ "number": 1, "text": "Now when Jesus saw the crowds..." }]
      }
    }],
    "team": [
      { "person_name": "James Okafor", "position": "Worship Leader", "status": "accepted" }
    ]
  }]
}
```

**Resolved scripture text is required** (R11.5). Stage does not hold a bible, does not call a bible
API, and therefore cannot fail to render a passage because the wifi is down. The verse array rather
than one string is what makes verse-boundary splitting possible (ST7.3).

`key_override` on the plan item is what a leader sets when this Sunday's key differs from the
arrangement's. Stage transposes from the arrangement key to the override using `packages/songs`, the
same code that produces the printed chart.

## Media

```
GET /api/stage/v1/media/<id>/url

200
{ "url": "<signed URL, Supabase Storage>", "expires_at": "...", "content_hash": "sha256:...", "byte_size": 182344 }
```

- Media is fetched on demand, cached locally **by content hash**, and verified against the hash
  before use (ST4.9).
- The signed URL is short lived. Stage fetches a fresh one when it needs the file, and never stores
  the URL.
- Byte range requests are supported by storage, so an interrupted download resumes.
- A file that fails verification is deleted and refetched once. After that it is treated as missing,
  which degrades to the theme colour (ST9.9).

## Pushing usage

The only write.

```
POST /api/stage/v1/usage
{ "rows": [{
    "client_id": "uuid generated by Stage",
    "song_id": "uuid",
    "arrangement_id": "uuid",
    "plan_item_id": "uuid | null",
    "service_occurrence_id": "uuid | null",
    "used_on": "2026-10-04",
    "key_used": "E",
    "source": "stage"
  }] }

200
{ "accepted": ["<client_id>"], "duplicates": ["<client_id>"], "rejected": [{ "client_id": "...", "reason": "unknown_song" }] }
```

- **Idempotent on `client_id`**, which is unique per tenant. A row pushed twice lands in
  `duplicates` and changes nothing (ST18.3).
- Queued locally while offline and pushed on reconnect. The queue is durable across restarts.
- `plan_item_id` is null for a song added live in Stage and not in the plan, which is exactly the
  usage a church forgets to report (ST18.4).
- `used_on` is a date in the tenant's timezone, which the pairing response supplied.
- `source` is always `stage` from this endpoint. The server does not trust the client's value for
  anything that matters, and sets it.

Service run telemetry (ST18.5) is a later addition under `POST /api/stage/v1/runs`, specified when
S0.5 is planned.

## Promoting a local song

The second write, and the one that lets a church that started on Stage alone move its library into
Hearth when it adopts the platform.

```
POST /api/stage/v1/songs/promote
{ "client_id": "uuid generated by Stage",
  "song": { ...the same song body this interface returns, with its sections and arrangements... } }

201
{ "song_id": "uuid", "arrangement_ids": { "<stage arrangement id>": "<platform arrangement id>" } }

200
{ "duplicate_of": "uuid", "matched_on": "ccli_number | title_and_first_line" }
```

- **On the operator's action only** (ST4.11). A sync does not push songs upward.
- Idempotent on `client_id`.
- The platform runs its own duplicate check on CCLI number, then title and first line, and a match
  comes back as `duplicate_of` with nothing written. Stage shows the operator the existing song and
  offers to adopt it in place of promoting.
- A promoted song arrives in the platform library like any other song, through the same validation the
  web UI uses. It is not a privileged insert.
- On success Stage marks its local copy as `hearth` with the returned id, so the library stops having
  two rows for one song and the platform becomes the writer.
- The device principal may insert a song and may not update or archive one. A correction after
  promotion is made in Hearth, by a person.

*This is the only path by which data Stage authored enters the platform.*

## Errors

| Status | Meaning | Client behaviour |
|---|---|---|
| 401 `device_revoked` | Device revoked | Stop syncing, say so, keep serving the cache |
| 401 `invalid_token` | Token not recognised | Same, and offer repairing |
| 403 `out_of_scope` | A path the device may not read | Log, report as a defect, carry on |
| 404 | Unknown id | Tombstone it locally |
| 409 `cursor_invalid` | Cursor too old or from a reset tenant | Full resync, cache rebuilt |
| 429 | Rate limited | Honour `Retry-After` with jitter |
| 5xx | Server trouble | Exponential backoff to a five minute ceiling, and keep serving the cache |

**No error on this interface is allowed to interrupt a service.** The client's error path always ends
in "keep serving the cache" (ST4.7, ST19.6).

## Rate limits

Per device: 60 requests a minute sustained, 300 in a burst. The normal Sunday cost of the whole
contract is one `changes` loop and a handful of body fetches, so a church never approaches the limit.
A client that hits 429 is a client with a bug.

## What is deliberately absent

- **No realtime subscription.** Carried from the platform decision that Supabase Realtime is unused
  in v1. A live plan change is a poll, and ST5.11 makes it an offer rather than an
  interruption.
- **No update path for songs, plans, or lyrics.** A song is inserted once by promotion and is the
  platform's thereafter. ST6.8's typo correction stays with the run, and a correction that should
  stick is made in Hearth by a person.
- **No bible API.** Resolved text only.
- **No person data beyond names and positions.**
- **No analytics.** Usage rows serve the church's CCLI obligation and nothing else (ST18.6).

## Server-side work this implies, for the platform board

| Work | Requirement | Note |
|---|---|---|
| `change_seq` column and per-tenant sequence on every synced table | R11.14, R12.13 | Set by the same trigger that writes the audit entry |
| Device principal: table, token hashing, scope enforcement in the query layer | R11.14, R1.5 | Not a row in the user table, and not a role |
| Pairing code generation in the platform UI, with the device list and revoke | R1.10 | Sits with the active session list, which already exists |
| The nine routes in this document under `/api/stage/v1` | R11.14, R12.13 | Field-level permission applied at the query layer |
| Idempotent `song_usage` insert keyed on `client_id` | R12.9, R12.10 | Feeds the CCLI export that already exists in 0.4. Stage's own local export is validated against the same fixture, so the two agree. |
| `POST /api/stage/v1/songs/promote`, with the duplicate check | R12.1 to R12.5, R12.12 | Reuses the manual-entry validation R12.12 already needs |
| An adversarial test suite for the device principal | R1.3, R21.2 | Every refused entity in the scope table, through the ORM and raw SQL |

These are platform stories with platform IDs. They are written on [BACKLOG.md](../BACKLOG.md) when
0.4 is planned, and they are the reason this document exists before Stage is built.

**None of them blocks Stage releases S0.1 to S0.3.** Those are a complete standalone presenter. This
interface gates exactly one Stage epic, SE4, which is tracked on
[BACKLOG-STAGE.md](../BACKLOG-STAGE.md).

### One correction owed in PRD.md

Section 9.6 reads "Stage is a client of a versioned sync API, not a second application with a second
database." Stage holds a real library of its own, so the line needs replacing. PRD.md belongs to the
platform board, and the replacement wording is in [PRD-STAGE.md](../PRD-STAGE.md) section 2.
