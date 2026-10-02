# Hearth Stage, user journeys

What people actually do, end to end, in the order they do it.
[PRD-STAGE.md](../PRD-STAGE.md) says what Stage must do and
[BACKLOG-STAGE.md](../BACKLOG-STAGE.md) says when each piece gets built. This document is the join
between them: it is how we check that the stories add up to something a church can use, rather than
to a list of features that each work.

**State** says what is true today, 1 October 2026. It is the honest column.

---

## The flow, in one picture

```
  A SONG GETS IN                        A SERVICE GETS BUILT
  ──────────────                        ────────────────────
  typed in Stage          ┐                      ┐
  imported from           ├──► library.db ───────┤
  ProPresenter, OpenLP,   │    (Stage owns it)   │
  EasyWorship, OpenSong   ┘                      │
                                                 ├──► set list, built in Stage
  synced from Hearth ────────► cache.db ─────────┤         or
  (a paired church)           (read only)        └──► plan, built in Hearth by
                                                      the person who runs Sunday

                              IT BECOMES SLIDES
                              ─────────────────
                    set list or plan + songs + arrangements
                                     │
                                     ▼  compileDeck()   pure, deterministic
                         resolve each arrangement's sequence
                              V1 C V2 C B C C
                                     │
                                     ▼  split each section on the theme's limit
                              Deck { groups, cues }
                                     │
                     ┌───────────────┼───────────────┐
                     ▼               ▼               ▼
              control surface   OutputState    stage display
              (the operator)    (the wall)     (the band)
                     │
                     └──► intent: advance, back, black, jump
                                     │
                                     ▼
                               main recomputes,
                               broadcasts state

  AFTERWARDS
  ──────────
  every song shown ──► usage log ──► CCLI report (on the laptop)
                                └──► pushed to Hearth, if paired
```

Two properties of that picture are the whole product. **A song never gets transformed on its way to
a slide**, because the thing a church edits is already the thing a renderer reads. And **state flows
one way**: main owns it, windows receive it, windows send intents back. That is why the phone remote,
a Stream Deck and crash recovery are the same code path rather than three.

---

## J1. James installs Stage and runs a rehearsal

**Who:** James, worship leader, 34, volunteer, four hours a week. He has never heard of Hearth the
management system. He found Stage because he is tired of paying for ProPresenter himself.

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | Downloads Stage for macOS and opens it. It presents without signing in to anything. | ST1.1 | Shell built, installer is STG-138 |
| 2 | Stage offers to import a library, or to start with a public-domain sample set. He takes the sample. | ST1.2 | Fixtures exist, the offer is STG-10 |
| 3 | Types in a song from Sunday: title, author, CCLI number, lyrics as labelled sections. | ST2.1, ST2.2 | Store built, the screen is STG-7 |
| 4 | Adds an arrangement: key of G, and a sequence of `V1 C V2 C B C C`. | ST2.3 | Store built, the screen is STG-9 |
| 5 | Builds a set list of four songs for Thursday rehearsal. | ST2.8 | STG-46 |
| 6 | Plugs the laptop into the hall's projector. Stage puts the output on it, fullscreen, no chrome. | ST10.1 | Built |
| 7 | Runs the set with the arrow keys. The band reads the words off the wall. | ST12.1 | Built |

**The test of this journey:** he gets from download to a slide on a wall without reading anything,
and without the building having internet.

---

## J2. The church moves its library off ProPresenter

**Who:** James again, two weeks later, with 300 songs he is not retyping.

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | Points Stage at the ProPresenter library folder. | ST3.1 | STG-35 |
| 2 | Stage reads it and reports before writing: 300 songs, 284 with section structure, 16 without, 7 duplicates of songs already here. | ST3.2, ST3.3 | STG-38 |
| 3 | Chooses to skip the duplicates and import the rest. | ST3.5 | STG-39 |
| 4 | The 16 unstructured songs are listed for review, so they are a known problem rather than a surprise on a Sunday. | ST3.2 | STG-33 to STG-36 |
| 5 | Media files the library referenced are matched on disk; four are missing and named. | ST3.6 | STG-41 |
| 6 | A week later he realises the import brought in rubbish from 2011. He undoes the whole import. | ST3.4 | STG-40 |

**The test of this journey:** section labels survive on every song that had them, and the report
names every song that did not. A presenter that cannot read a church's existing library has no users,
which is why this is in S0.2 rather than at the end.

---

## J3. James builds Sunday's set, on Thursday, in twenty minutes

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | Searches the library by a half-remembered line of lyrics. | ST2.4 | STG-42 |
| 2 | Adds four songs and a reading to a set list, dated Sunday. | ST2.8 | STG-46 |
| 3 | Drops the second song a tone because the congregation cannot reach it. The chart transposes. | ST2.6, ST5.6 | Built |
| 4 | Prints the chart for the band, in the new key, chords over the words. | ST2.6 | Built in the domain, the screen is STG-44 |
| 5 | Types `Psalm 23:1-6`, which resolves from the bundled KJV with no internet. | ST7.1, ST7.2 | STG-55, STG-56 |
| 6 | Duplicates last week's set as a starting point instead of building from nothing. | ST2.9 | STG-47 |

---

## J4. The Sunday operator runs the service

**Who:** whoever is on the rota. Sixteen years old this week. Has opened Stage twice.

**The design case: 10:28.** The service starts at 10:30. The order changed on Thursday. The laptop is
on battery, driving a projector through an adapter bought in 2017, on wifi that drops. Nobody is
available to help.

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | Opens Stage. It offers Sunday's set list, because it is the next one by date. One keypress. | ST12.5 | STG-48 |
| 2 | Reads the six keys along the bottom of the screen. That is the entire training. | ST12.10 | Built |
| 3 | Starts the pre-service countdown to 10:30. It is anchored to the clock, so restarting Stage resumes it correctly. | ST13.1 | STG-73 |
| 4 | Presses space when the band starts. The slide cross-dissolves. | ST6.5 | Built |
| 5 | Sees what is live, what is next, and whether the output is black, at all times. | ST12.6 | Built |
| 6 | The leader repeats the chorus a third time. The operator presses back once. | ST5.9 | Built |
| 7 | The leader calls a song that is not in the set. The operator types three letters and it is in the deck. | ST5.8 | STG-49 |
| 8 | Presses **B** during the prayer and **B** again after it. The exact slide comes back. | ST6.6 | Built |
| 9 | Walks into the sermon. The output goes empty and the deck says so, so they keep their place. | ST5.4 | Built |
| 10 | Cannot delete a song, edit the library, or change a theme, because none of it is reachable from here. | ST12.3 | Built |

**The test of this journey:** a full service with the trackpad physically disconnected, by somebody
who was handed the laptop five minutes earlier.

---

## J5. The room: a projector, a stage display and a foyer screen

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | Three displays. The operator assigns lyrics to the projector, the confidence monitor to the screen facing the platform, and the announcement loop to the foyer. | ST10.3 | STG-63 |
| 2 | The band sees current slide, next slide, the remaining sequence, chords in the right key, a clock and a timer. | ST11.1 to ST11.4 | STG-59 to STG-62 |
| 3 | The foyer rotates announcements while the main screen shows lyrics. | ST13.4 | STG-75 |
| 4 | Somebody unplugs the projector and plugs it back in. The same output returns to the same display with no reconfiguration. | ST10.4 | STG-64 |
| 5 | Before the service, a test pattern per output shows the safe areas, so they find out the projector is clipping the edges now rather than at 10:31. | ST10.7 | STG-66 |

---

## J6. The church adopts Hearth, and pairs Stage with it

**Who:** Maria, the administrator, who has never opened Stage and never will.

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | Maria generates a six character pairing code in Hearth. | ST1.3 | STG-88, blocked on platform 0.4 |
| 2 | James types it into Stage once. Stage receives a device token and the church's identity. | ST1.3 | STG-88 |
| 3 | Sunday's plan, the songs, the arrangements, the keys and the resolved scripture arrive. Nothing is exported and no file is carried across the room. | ST4.1, ST4.2 | STG-92 |
| 4 | Songs that came from Hearth are read-only in Stage. Songs James typed in stay his. | ST2.13 | STG-93 |
| 5 | He promotes his own 40 songs up into the church library, once, by choosing to. Duplicates are matched on CCLI number first. | ST2.14 | STG-98 |
| 6 | The plan notes appear: the global ones, and the one addressed to Drums. | ST5.5 | STG-100 |
| 7 | The announcement loop is now built from what Maria typed in Hearth on Thursday. Nobody rebuilds it. | ST13.5 | STG-102 |

**The test of this journey:** a plan edited in Hearth on Saturday night is on the screen on Sunday
morning, and the whole service still runs after the network cable is pulled out mid-set.

---

## J7. The plan changes at 10:15, from the car park

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | James reorders two songs on his phone, in Hearth. | R11.2 | Platform |
| 2 | Stage notices, and offers the change as a named, dismissible card. | ST5.11 | STG-103 |
| 3 | The operator is mid-song. **The live slide does not move.** The offer waits. | ST5.11 | STG-103 |
| 4 | Between items, the operator accepts it. The deck recompiles and stays on the same slide, because a cue is identified by its section and its repeat rather than by a position. | ST5.11 | Built in the session |

---

## J8. Something goes wrong

The journey that decides whether a church trusts Stage.

| What goes wrong | What Stage does | Req | State |
|---|---|---|---|
| The wifi dies mid-service | Nothing changes. Everything needed was on disk before the service. | ST4.10, ST21.3 | By design, STG-97 |
| The laptop is unpaired or the token revoked | Keeps the local library and keeps running the service in progress. | ST1.7 | STG-90 |
| Stage is killed mid-song | Comes back to the live slide inside five seconds, with its output configuration and timers. | ST19.1 | STG-76 |
| One output renderer crashes | That screen is restarted. The others keep running. | ST19.3 | Built |
| The projector is unplugged | Stage stays up. The output returns on reconnection, on the live slide. | ST10.5 | STG-64 |
| A background file is missing or undecodable | The slide falls back to the theme colour. The control surface says what happened, the wall says nothing. | ST9.9 | STG-71 |
| The synced cache is corrupt | Rebuilt by a resync. The library a church typed in is a separate file and survives. | ST19.4 | Built in the store |
| The library file is lost | Restored from the automatic backup: every section, arrangement and chart. | ST19.5 | Built |
| An update breaks Sunday | Rolled back from inside Stage, by a volunteer. Updates never apply inside a Sunday window. | ST19.7, ST19.8 | STG-139, STG-140 |

---

## J9. January: the CCLI report

**Who:** Maria, or James, or whoever remembers. Churches are fined for failing this, and no free
presenter does it.

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | Every song actually shown was logged at the moment it went on the screen, with its date, key and arrangement. | ST2.10 | STG-52 |
| 2 | Including the one called from the floor that was never in the set, which is exactly the usage a church forgets. | ST18.4 | STG-105 |
| 3 | Exports the period's report in the format CCLI accepts. | ST2.11 | STG-53 |
| 4 | A paired church finds the same data already in Hearth, because Stage pushed it. | ST18.1 | STG-105 |

---

## J10. The livestream wants a lower third

**Who:** the production volunteer, who owns a Stream Deck and knows what NDI is. Stage must not
require them and must not insult them.

| Step | What happens | Req | State |
|---|---|---|---|
| 1 | Turns on NDI output. OBS sees Stage as a source, with no capture card. | ST16.1 | STG-126 |
| 2 | Uses an alpha-keyed output so lyrics key over camera with clean edges. | ST16.2 | STG-127 |
| 3 | Gives the keyed output its own theme, because lyrics sized for a projector are wrong over camera. | ST16.3 | STG-128 |
| 4 | Binds a Stream Deck button to black the main output and show the lower third at once. | ST12.9, ST15.1 | STG-112, STG-113 |
| 5 | A hearing-impaired viewer reads the caption track, fed from the current slide. | ST17.3 | STG-131 |

---

## What these journeys say about the order of work

Reading them together changes nothing about the plan, which is a good sign, and confirms three
things.

**J1 and J4 are the journeys that have to be perfect**, and they are the ones with the least in them.
Download, type a song in, run a service. Everything in S0.1 and S0.2 serves one of those two.

**J2 is the gate on adoption.** A church with 300 songs in ProPresenter cannot start at J1 step 3.
This is why import moved forward from S1.0 to S0.2.

**J8 is the journey nobody asks for and every church eventually needs.** It is spread across S0.3 and
S0.4 rather than deferred, because the first time a church is let down on a Sunday is the last
Sunday it uses Stage.

**J6, J7, J9 and J10 are why the two products are one platform**, and none of them is reachable
without the platform's 0.4. They are also the reason Stage is worth building rather than being the
nineteenth free presenter.
