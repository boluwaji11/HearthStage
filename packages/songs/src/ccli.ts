/**
 * STG-53, ST2.11, ST18.7. The CCLI usage report.
 *
 * A church with a CCLI licence has to report what it sang. Small churches get
 * fined for failing it, and no free presenter does it, so this is one of the
 * few places Stage is the only answer a church has.
 *
 * Pure, and here rather than in the application, because the platform's R12.10
 * export has to produce the same rows from the same facts. The fixture in
 * `fixtures.ts` is the agreement between them: if the two ever disagree, one of
 * them is wrong and a church gets a report its licence does not accept.
 */

/** One song on one service, which is what the log holds. */
export interface UsageRow {
  songId: string;
  title: string;
  author?: string | null;
  ccliNumber?: string | null;
  /** YYYY-MM-DD, in the church's own timezone. */
  serviceDate: string;
  /**
   * Which service on that date, where a church holds more than one.
   *
   * Null for a song put up with no plan open. Two services on one day are two
   * uses, and the date alone cannot tell them apart.
   */
  setListId?: string | null;
}

/** One song across the period, which is what CCLI asks for. */
export interface ReportLine {
  songId: string;
  title: string;
  author: string;
  ccliNumber: string;
  /** How many services it was sung in, over the period. */
  uses: number;
  /** Every service date it was sung on, earliest first. */
  dates: string[];
}

export interface Report {
  from: string;
  to: string;
  lines: ReportLine[];
  /**
   * Services in the period, which is what a church checks the total against.
   *
   * Counted by the plan rather than by the date, because a church with a
   * morning and an evening service held two.
   */
  services: number;
  /**
   * Songs sung with no CCLI number on them (ST2.11).
   *
   * Reported rather than dropped. A hymn out of copyright needs no number and
   * belongs in the count; a song somebody typed in a hurry needs one, and the
   * church is the only one who can tell the two apart.
   */
  missingNumbers: number;
}

/** Both ends are in it, because a church asking for January to June means June. */
function within(row: UsageRow, from: string, to: string): boolean {
  return row.serviceDate >= from && row.serviceDate <= to;
}

/**
 * The report for a period.
 *
 * Grouped by song rather than by service, because the licence is counted per
 * song. Ordered by title, which is the order a person checks a report in, with
 * the song id breaking a tie so two songs of one name keep a stable order.
 */
export function usageReport(rows: readonly UsageRow[], from: string, to: string): Report {
  const inPeriod = rows.filter((row) => within(row, from, to));

  const bySong = new Map<string, ReportLine>();
  for (const row of inPeriod) {
    const found = bySong.get(row.songId);
    if (found === undefined) {
      bySong.set(row.songId, {
        songId: row.songId,
        title: row.title,
        author: row.author ?? "",
        ccliNumber: row.ccliNumber ?? "",
        uses: 1,
        dates: [row.serviceDate],
      });
      continue;
    }
    found.uses += 1;
    found.dates.push(row.serviceDate);
  }

  const lines = [...bySong.values()]
    .map((line) => ({ ...line, dates: [...line.dates].sort() }))
    .sort((a, b) => a.title.localeCompare(b.title) || a.songId.localeCompare(b.songId));

  return {
    from,
    to,
    lines,
    services: new Set(inPeriod.map((row) => `${row.serviceDate}:${row.setListId ?? ""}`)).size,
    missingNumbers: lines.filter((line) => line.ccliNumber === "").length,
  };
}

/** The columns CCLI asks for, in the order it asks for them. */
export const CCLI_COLUMNS = ["Song Title", "Author", "CCLI Song Number", "Uses", "Dates Used"] as const;

/**
 * One field of a CSV.
 *
 * Quoted whenever it holds a comma, a quote or a newline, with quotes doubled.
 * A hymn called `Blessed Assurance, Jesus Is Mine` breaks a report that does
 * not do this, and that is a real hymn title.
 */
function field(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * The report as the file a church uploads.
 *
 * CRLF line endings, because the format is RFC 4180 and the spreadsheet a
 * church opens this in is usually Excel.
 */
export function usageCsv(report: Report): string {
  const rows = [
    [...CCLI_COLUMNS],
    ...report.lines.map((line) => [
      line.title,
      line.author,
      line.ccliNumber,
      String(line.uses),
      line.dates.join(" "),
    ]),
  ];
  return rows.map((row) => row.map(field).join(",")).join("\r\n") + "\r\n";
}
