/**
 * STG-53, ST2.11, R12.10. The fixture both exports are checked against.
 *
 * Stage exports this report from its local log, and the platform exports the
 * same report from its own. The two must agree, so they agree on this: the same
 * six months of services in, the same CSV out.
 *
 * The platform consumes `@hearth/songs` as a package, so when R12.10 is built it
 * imports these two values and asserts the same thing. A change here is a change
 * to a contract, so it is a change to both boards.
 *
 * What it is built to catch:
 *   - a song sung in several services counting once per service
 *   - a song sung twice in one day on two services counting twice
 *   - a date on the first and last day of the period being in it
 *   - a date a day outside it being out
 *   - a hymn with no CCLI number still being listed
 *   - a comma and a quote in a title surviving the CSV
 */

import type { UsageRow } from "./ccli";

export const CCLI_PERIOD = { from: "2026-01-01", to: "2026-06-30" } as const;

export const CCLI_FIXTURE: UsageRow[] = [
  // Out of the period by one day at each end.
  { songId: "s1", title: "Amazing Grace", author: "John Newton", ccliNumber: "22025", serviceDate: "2025-12-31", setListId: "p0" },
  { songId: "s1", title: "Amazing Grace", author: "John Newton", ccliNumber: "22025", serviceDate: "2026-07-01", setListId: "p7" },

  // On the first and last day, which are in it.
  { songId: "s1", title: "Amazing Grace", author: "John Newton", ccliNumber: "22025", serviceDate: "2026-01-01", setListId: "p1" },
  { songId: "s1", title: "Amazing Grace", author: "John Newton", ccliNumber: "22025", serviceDate: "2026-06-30", setListId: "p6" },
  { songId: "s1", title: "Amazing Grace", author: "John Newton", ccliNumber: "22025", serviceDate: "2026-03-15", setListId: "p3" },

  // Two services on one day. Two uses, because the church sang it twice.
  { songId: "s2", title: "Blessed Assurance, Jesus Is Mine", author: "Fanny Crosby", ccliNumber: "22324", serviceDate: "2026-02-08", setListId: "morning" },
  { songId: "s2", title: "Blessed Assurance, Jesus Is Mine", author: "Fanny Crosby", ccliNumber: "22324", serviceDate: "2026-02-08", setListId: "evening" },

  // A hymn out of copyright, which needs no number and is still listed.
  { songId: "s3", title: "Holy, Holy, Holy", author: "Reginald Heber", ccliNumber: null, serviceDate: "2026-04-05", setListId: "p4" },

  // A quote in the title, which a report that does not escape it will break.
  { songId: "s4", title: '"Take Up Thy Cross", the Savior Said', author: "Charles Everest", ccliNumber: "91234", serviceDate: "2026-05-17", setListId: "p5" },
];

/** What `usageCsv(usageReport(CCLI_FIXTURE, from, to))` has to produce. */
export const CCLI_EXPECTED_CSV =
  'Song Title,Author,CCLI Song Number,Uses,Dates Used\r\n' +
  '"""Take Up Thy Cross"", the Savior Said",Charles Everest,91234,1,2026-05-17\r\n' +
  'Amazing Grace,John Newton,22025,3,2026-01-01 2026-03-15 2026-06-30\r\n' +
  '"Blessed Assurance, Jesus Is Mine",Fanny Crosby,22324,2,2026-02-08 2026-02-08\r\n' +
  '"Holy, Holy, Holy",Reginald Heber,,1,2026-04-05\r\n';
