# What a presenter has, and what Stage has

A feature inventory against ProPresenter 7, EasyWorship 7, OpenLP 3 and FreeShow,
written because Stage replaces one of those on a church's media desk and a
church will judge it by whether the thing it did last Sunday still works.

**Have** means built. **Planned** means it has a story on
[BACKLOG.md](../BACKLOG.md). **Missing** means this document is the first time it
has been written down, which was the point of writing it. **Refused** means a
deliberate non-goal, with the reason.

---

## 1. The correction this document made

Stage's model was wrong, and it was wrong in a way that would have cost a
rewrite.

**The specification treated a song as the central object.** Songs have lyrics in
labelled sections, arrangements with sequences, keys and charts, and that part is
right: it is the spine the whole platform is built on, and it is what no other
presenter can match.

But in every presenter a church actually uses, the central object is a
**presentation**: an ordered set of slides. A song is one kind of presentation. A
sermon outline is another. So are a welcome slide, three announcement slides, a
title card, a blank, a verse of scripture, a video with no words on it, and the
notice about the car park.

A model that can only hold songs can present roughly a third of a Sunday.

So the object model is corrected here, and PRD domain 2 is rewritten around it:

```
  Presentation            an ordered set of slides, with a kind
    kind: song            lyrics in labelled sections, arrangements, chart, key
    kind: scripture       a passage, split at verse boundaries
    kind: slides          anything a person typed: sermon points, notices, a title
    kind: media           a video or image that fills the screen with no text
    │
    ├── Slide             text content, a template, optional per-slide background
    └── Arrangement       for a song: an order of section labels

  Library                 presentations, searchable, organised
  Playlist                the running order for one service, holding presentations,
                          media, headers and timers
  Media                   images, video loops, audio, organised and reusable
  Theme                   how a slide looks. Applied to content, and kept out of it.
  Look                    which layers are on, per output
  Prop                    an overlay shown independently of the slide
  Message                 live text, typed and shown without touching the deck
```

A song is still special, because the sections and the sequence are what let a
paired church's plan become slides with no import step. It is special **as a kind
of presentation** rather than as the only thing that exists.

---

## 2. Content and the library

| Feature | ProPresenter | Stage |
|---|---|---|
| Song with sections and arrangements | Yes | **Have.** The schema, sequence resolution and slide splitting are built |
| Chord charts, transposition | Imports them; transposes | **Have.** ChordPro, any key, spelling follows the target key |
| A presentation of plain slides a person typed | Yes, central to the product | **Missing.** Now PRD domain 2, stories STG-145 to STG-149 |
| Slide groups with colours | Yes | **Planned.** Section type carries this already |
| Several arrangements per presentation | Yes | **Have** |
| Library search | Yes | **Planned**, STG-42 |
| Collections and folders | Yes | **Missing.** Now STG-150 |
| Scripture, several translations | Yes, a paid add-on for some | **Planned.** Public-domain bundled, licensed text from a paired church |
| Media library, images and video, reusable | Yes, the media bin | **Missing.** Now STG-151 to STG-153 |
| Audio library and playlists | Yes | **Planned**, STG-118 |
| Import from other presenters | Limited | **Planned**, STG-32 to STG-41. A one-time escape hatch |
| Export the library | Partial | **Planned**, STG-54. Ungated, which they do not do |
| CCLI SongSelect import | Yes, with a licence | Deferred. The platform's R12.11 |
| CCLI usage reporting | No | **Planned**, STG-53. Churches are fined for failing this and nobody free does it |

## 3. Building a service

| Feature | ProPresenter | Stage |
|---|---|---|
| Playlist of items for one service | Yes | **Planned** as the set list, STG-46 |
| Items that are media, headers or timers | Yes | **Missing.** Now STG-154 |
| Reuse last week's order | Yes | **Planned**, STG-47 |
| The order arriving from the church's own plan | **No, and it cannot** | **Planned**, STG-99. This is the product |
| Notes per item and per slide | Yes | **Planned**, STG-100. Per-slide notes now STG-155 |
| Printable order | Yes | Deferred. The platform prints it |

## 4. Presenting

| Feature | ProPresenter | Stage |
|---|---|---|
| Advance, reverse, jump | Yes | **Have** |
| Jump by typing a label | Yes | **Planned**, STG-50 |
| Add something live, mid-service | Yes | **Planned**, STG-49 |
| Clear everything | Yes | **Have**, as black and clear |
| **Clear one layer**: background, slide or props separately | Yes, clear groups | **Missing.** Now STG-156. A single blank state is not enough |
| Logo | Yes | **Have** |
| Slide transitions, global and per slide | Yes | **Have** global, per slide now STG-157 |
| Text revealed line by line | Yes, builds | **Missing.** Now STG-158, deliberately limited |
| Live edit of a slide mid-service | Yes | **Planned**, STG-51 |
| Messages: live lower-third text with fields | Yes | **Missing.** Now STG-159 |
| Props: overlays independent of the slide | Yes | **Planned**, STG-119 |
| Countdowns and clocks | Yes | **Planned**, STG-73, STG-74 |
| Announcement rotation | Yes | **Planned**, STG-75 |
| Audio and video as items | Yes | **Planned**, STG-118 |
| Live camera as a background | Yes | **Planned**, STG-136 |

## 5. The room, and the outputs

| Feature | ProPresenter | Stage |
|---|---|---|
| Several outputs, different content each | Yes, audience and stage screens | **Planned**, STG-63 |
| One output, fullscreen, with no chrome and the cursor hidden | Yes | **Have** |
| Output remembered per physical display | Yes | **Planned**, STG-64 |
| **Layers and looks**: background, slide, props, live video, foreground, per output | Yes, and it is how the product is operated | **Missing.** Now PRD domain 10, stories STG-160 to STG-162 |
| Stage display with current, next, notes, clock, timer | Yes | **Planned**, STG-59 to STG-62 |
| Stage display layouts, several | Yes | **Planned**, STG-62 |
| Test pattern per output | No | **Planned**, STG-66 |
| Masks and edge blending for odd projection | Yes | **Refused** for v1. A church with a curved screen has a projector that does this in hardware |
| NDI output | Yes | **Planned**, STG-126 |
| Alpha-keyed output for a livestream | Yes | **Planned**, STG-127 |
| SDI output | Yes, with hardware | **Refused.** That is a capture card's job |
| Recording or streaming the output | Yes, capture | **Refused.** OBS is free, better at it, and already in the building |

## 6. Design

| Feature | ProPresenter | Stage |
|---|---|---|
| Themes applied to content | Yes, templates | **Have** as data, editing is STG-133 |
| A theme per content kind | Partly | **Planned**, STG-80 |
| Text that fits the screen, measured | Yes | **Have**, and one size shared across a section |
| A slide editor: text boxes, images, shapes, layout | Yes, a full editor | **Refused as a design tool.** Typing a slide and choosing a template is in (STG-145). Moving text boxes around with a mouse is not: it is how a free presenter ends up with a bad Keynote inside it, and how every church's slides end up different |
| Fonts the church owns | Yes | **Planned**, STG-135 |
| A contrast floor that refuses an unreadable theme | **No** | **Have.** 7:1, checked on the values |

## 7. Control and integration

| Feature | ProPresenter | Stage |
|---|---|---|
| Keyboard operation throughout | Yes | **Have** |
| Phone or tablet remote | Yes, a separate paid app | **Planned**, STG-108. Free, in a browser, no install |
| A remote for the band and the preacher | Yes, ProPresenter Stage | **Planned**, STG-142 |
| Stream Deck | Yes | **Planned**, STG-113 |
| MIDI, OSC | Yes | **Planned**, STG-114, STG-115 |
| Macros | Yes | **Planned**, STG-112 |
| Triggers out to a lighting desk | Yes | **Planned**, STG-116 |
| A documented local API | Partly | **Planned**, STG-143 |
| Ableton or MultiTracks session playback | Yes | **Refused.** Separate product, separate hardware, and pretending otherwise is how Stage never ships |

## 8. What a church notices when it goes wrong

The column nobody compares on, and the one that decides whether a church stays.

| Feature | ProPresenter | Stage |
|---|---|---|
| Runs with no internet | Yes | **Have**, and it is the design |
| Crash recovery to the live slide | Partly | **Planned**, STG-76, inside five seconds |
| One output crashing leaves the others up | No | **Have** |
| A display unplugged mid-service | Survives | **Planned**, STG-64 |
| A missing media file | Shows an error on the screen | **Planned**, STG-71. Falls back to the theme colour; the wall says nothing |
| The library backed up and restorable | Manual | **Have**, on every write, with a verified restore |
| Rolling back a bad update | No | **Planned**, STG-140 |
| An update applying on a Sunday morning | Possible | **Planned**, STG-139. Refused inside a Sunday window |

---

## 9. What this inventory changed

Eighteen stories were added and one PRD domain was rewritten. The four that
matter:

1. **A presentation of plain slides** (STG-145 to STG-149). Without it Stage can
   present the songs and the readings and nothing else, which is not a service.
2. **A media library** (STG-151 to STG-153). Backgrounds were specified as a
   property of a theme or an item, which means the same video has to be found on
   disk again every time somebody wants it.
3. **Layers and looks** (STG-160 to STG-162). ProPresenter is operated through
   them: clear the slide and leave the background, show a prop over a video, put
   a different look on the foyer screen. Stage had one blank state, which cannot
   express any of that.
4. **Messages** (STG-159). Live text with fields, typed and shown without
   touching the deck. It is how somebody is told their car is being towed.

Two things were refused outright and written down so they stop coming back: a
slide editor as a design tool, and capture or streaming of the output. OBS is
free, is better at the second, and is already in the building.

**None of this changes the thesis.** A church installs Stage because it is a
complete presenter, and keeps it because it is the only one that already knows
this Sunday. The inventory is about the first half of that sentence, which is the
half that gets Stage onto the laptop at all.
