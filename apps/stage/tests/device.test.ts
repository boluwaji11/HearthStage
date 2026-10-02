/**
 * STG-14, ST1.1, ST1.9. The laptop, and what it calls itself.
 *
 * Stage signs in to nothing, so this file is the whole of its identity. The
 * tests are mostly about a church that renamed a laptop keeping that name, and
 * about the application starting anyway when the file holding it is damaged,
 * because a machine that will not open on a Sunday morning over a name is the
 * worse failure of the two.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEVICE_FILE, cleanName, nameFromHost, openDevice, renameDevice } from "../src/main/device";

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "hearth-device-"));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

function open(hostname = "Daniels-MacBook-Pro.local") {
  return openDevice(directory, { hostname, platform: "darwin", id: () => "device_1" });
}

describe("the name a machine arrives with", () => {
  it("is the machine's own, as a person writes it", () => {
    expect(nameFromHost("Daniels-MacBook-Pro.local")).toBe("Daniels MacBook Pro");
  });

  it("drops the suffix the network adds, whichever it is", () => {
    expect(nameFromHost("front-desk.lan")).toBe("front desk");
    expect(nameFromHost("booth.localdomain")).toBe("booth");
    expect(nameFromHost("booth.home.")).toBe("booth");
  });

  it("keeps a name that is already readable", () => {
    expect(nameFromHost("Sound Desk")).toBe("Sound Desk");
  });

  it("falls back where the machine has no name at all", () => {
    expect(nameFromHost("   ")).toBe("Stage");
  });

  it("refuses a name that is nothing, because a blank in a list of three helps nobody", () => {
    expect(cleanName("   ")).toBeNull();
    expect(cleanName("  Sound   Desk ")).toBe("Sound Desk");
  });
});

describe("this machine", () => {
  it("is made on the first run and written down", () => {
    const device = open();
    expect(device.name).toBe("Daniels MacBook Pro");
    expect(device.platform).toBe("darwin");
    expect(JSON.parse(readFileSync(join(directory, DEVICE_FILE), "utf8")).id).toBe("device_1");
  });

  it("keeps its id across runs, because the church's device list will use it", () => {
    const first = open();
    const second = openDevice(directory, {
      hostname: "something-else",
      platform: "darwin",
      id: () => "device_2",
    });
    expect(second.id).toBe(first.id);
  });

  it("keeps the name a church typed, whatever the machine is called", () => {
    const device = open();
    const renamed = renameDevice(directory, device, "Sound Desk");
    expect(renamed?.name).toBe("Sound Desk");
    expect(open().name).toBe("Sound Desk");
  });

  it("refuses a rename to nothing, and says so by returning nothing", () => {
    const device = open();
    expect(renameDevice(directory, device, "   ")).toBeNull();
    expect(open().name).toBe("Daniels MacBook Pro");
  });

  it("starts anyway on a damaged file, rather than refusing to open", () => {
    writeFileSync(join(directory, DEVICE_FILE), "{ this is not json");
    expect(open().name).toBe("Daniels MacBook Pro");
  });

  it("reads the platform from the machine rather than from the file", () => {
    open();
    const moved = openDevice(directory, { hostname: "booth", platform: "win32" });
    expect(moved.platform).toBe("win32");
  });

  it("asks for nothing but the machine's own name", () => {
    // The signature is the test. A hostname and a platform, both of which the
    // operating system answers with the network off (ST1.1).
    expect(openDevice.length).toBe(2);
  });
});
