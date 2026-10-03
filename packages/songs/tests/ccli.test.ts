/**
 * STG-53, ST2.11, ST18.7. The report a church's licence turns on.
 *
 * The fixture is the agreement with the platform's R12.10 export. If these two
 * ever disagree, one of them is wrong and a church gets a report CCLI does not
 * accept.
 */
import { describe, it, expect } from "vitest";
import { usageReport, usageCsv, CCLI_COLUMNS } from "../src/ccli";
import { CCLI_FIXTURE, CCLI_PERIOD, CCLI_EXPECTED_CSV } from "../src/ccli-fixture";

const report = usageReport(CCLI_FIXTURE, CCLI_PERIOD.from, CCLI_PERIOD.to);

describe("six months of services", () => {
  it("produces the CSV both exports have to produce", () => {
    expect(usageCsv(report)).toBe(CCLI_EXPECTED_CSV);
  });

  it("lists every song presented, once each", () => {
    expect(report.lines.map((line) => line.songId)).toEqual(["s4", "s1", "s2", "s3"]);
  });

  it("counts a song once per service it was sung in", () => {
    expect(report.lines.find((line) => line.songId === "s1")?.uses).toBe(3);
  });

  it("counts two services on one day as two", () => {
    expect(report.lines.find((line) => line.songId === "s2")?.uses).toBe(2);
  });

  it("takes both ends of the period", () => {
    const dates = report.lines.find((line) => line.songId === "s1")?.dates ?? [];
    expect(dates).toContain(CCLI_PERIOD.from);
    expect(dates).toContain(CCLI_PERIOD.to);
  });

  it("leaves out a service a day outside it", () => {
    const dates = report.lines.flatMap((line) => line.dates);
    expect(dates).not.toContain("2025-12-31");
    expect(dates).not.toContain("2026-07-01");
  });

  it("lists a hymn with no number, and says how many have none", () => {
    expect(report.lines.find((line) => line.songId === "s3")?.ccliNumber).toBe("");
    expect(report.missingNumbers).toBe(1);
  });

  it("counts the services in the period, which is what a church checks against", () => {
    // Seven plans across six dates, because one of those days held two.
    expect(report.services).toBe(7);
  });
});

describe("the file a church uploads", () => {
  it("names the columns CCLI asks for, in order", () => {
    expect(usageCsv(report).split("\r\n")[0]).toBe(CCLI_COLUMNS.join(","));
  });

  it("escapes a comma in a title, which is a real hymn title", () => {
    expect(usageCsv(report)).toContain('"Blessed Assurance, Jesus Is Mine"');
  });

  it("doubles a quote in a title", () => {
    expect(usageCsv(report)).toContain('"""Take Up Thy Cross"", the Savior Said"');
  });

  it("ends every line the way the format says, including the last", () => {
    const text = usageCsv(report);
    expect(text.endsWith("\r\n")).toBe(true);
    expect(text.split("\r\n").filter((line) => line !== "")).toHaveLength(5);
  });

  it("writes a header and nothing else for a period with no services", () => {
    const empty = usageReport(CCLI_FIXTURE, "2026-08-01", "2026-08-31");
    expect(empty.lines).toEqual([]);
    expect(empty.services).toBe(0);
    expect(usageCsv(empty)).toBe(`${CCLI_COLUMNS.join(",")}\r\n`);
  });
});

describe("the report itself", () => {
  it("reads in title order, which is the order a person checks it in", () => {
    const titles = report.lines.map((line) => line.title);
    expect([...titles].sort((a, b) => a.localeCompare(b))).toEqual(titles);
  });

  it("puts a song's dates in order", () => {
    const dates = report.lines.find((line) => line.songId === "s1")?.dates ?? [];
    expect([...dates].sort()).toEqual(dates);
  });

  it("leaves the rows it was given alone", () => {
    const before = JSON.stringify(CCLI_FIXTURE);
    usageReport(CCLI_FIXTURE, CCLI_PERIOD.from, CCLI_PERIOD.to);
    expect(JSON.stringify(CCLI_FIXTURE)).toBe(before);
  });
});
