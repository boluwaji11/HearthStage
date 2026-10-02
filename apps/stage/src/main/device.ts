/**
 * STG-14, ST1.1, ST1.9. The laptop, and what it calls itself.
 *
 * Stage opens and presents without signing in to anything, so there is no
 * account to hang an identity on. The laptop is the identity. It names itself
 * after the machine on first run, and a church with three of them renames them
 * to tell them apart.
 *
 * **It lives beside the library rather than in it.** A church that copies
 * `library.db` to a second laptop is copying their songs, and the second
 * laptop is still a different machine. A device name travelling inside the
 * library would give two machines one name on the day somebody most needs them
 * told apart.
 *
 * The name is not a secret and not a key. The device token that proves this
 * laptop is the church's goes in the keychain when pairing arrives (ST1.5), and
 * nothing here is a step towards signing in.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const DEVICE_FILE = "device.json";

/** The longest name worth putting in a list beside two others. */
export const MOST_NAME = 60;

export interface Device {
  /** This machine, to the platform, when pairing arrives. Made once. */
  id: string;
  name: string;
  /** "darwin", "win32", "linux". Shown in the church's device list (ST1.6). */
  platform: string;
  createdAt: string;
}

/**
 * The machine's name, as a person would write it.
 *
 * `Daniels-MacBook-Pro.local` is how the network says it and not how anybody
 * says it, so the suffix comes off and the hyphens become spaces. A machine
 * with no name at all gets the application's, because a blank in a list of
 * three laptops helps nobody.
 */
export function nameFromHost(hostname: string, fallback = "Stage"): string {
  const trimmed = hostname
    .trim()
    .replace(/\.(local|lan|home|localdomain)\.?$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return trimmed === "" ? fallback : trimmed.slice(0, MOST_NAME);
}

/** A name somebody typed, as it will be stored. Blank is refused. */
export function cleanName(name: string): string | null {
  const trimmed = name.replace(/\s+/g, " ").trim().slice(0, MOST_NAME);
  return trimmed === "" ? null : trimmed;
}

export interface DeviceOptions {
  hostname: string;
  platform: string;
  /** Overridden in a test, so the stored id and date are predictable. */
  id?: () => string;
  now?: () => string;
}

function freshId(): string {
  const stamp = Date.now().toString(36);
  const noise = Math.random().toString(36).slice(2, 10);
  return `device_${stamp}${noise}`;
}

function pathIn(directory: string): string {
  return join(directory, DEVICE_FILE);
}

/**
 * This machine, made on the first run and read on every one after.
 *
 * A file that cannot be read is replaced rather than thrown over. It holds a
 * name and a platform, both of which the machine can say again, so losing it
 * costs a church the name they typed and nothing else. Refusing to start over
 * a damaged file would cost them a service.
 */
export function openDevice(directory: string, options: DeviceOptions): Device {
  const path = pathIn(directory);
  const makeId = options.id ?? freshId;
  const now = options.now ?? ((): string => new Date().toISOString());

  try {
    const held = JSON.parse(readFileSync(path, "utf8")) as Partial<Device>;
    if (typeof held.id === "string" && held.id !== "") {
      const name = typeof held.name === "string" ? cleanName(held.name) : null;
      return {
        id: held.id,
        name: name ?? nameFromHost(options.hostname),
        // Read fresh. A library folder restored onto a different machine is
        // still this machine.
        platform: options.platform,
        createdAt: typeof held.createdAt === "string" ? held.createdAt : now(),
      };
    }
  } catch {
    // No file on the first run, and nothing worth keeping in a damaged one.
  }

  const made: Device = {
    id: makeId(),
    name: nameFromHost(options.hostname),
    platform: options.platform,
    createdAt: now(),
  };
  writeDevice(directory, made);
  return made;
}

export function writeDevice(directory: string, device: Device): void {
  writeFileSync(pathIn(directory), `${JSON.stringify(device, null, 2)}\n`);
}

/** Renames it, or returns null where the name was nothing. */
export function renameDevice(directory: string, device: Device, name: string): Device | null {
  const cleaned = cleanName(name);
  if (cleaned === null || cleaned === device.name) return null;
  const renamed = { ...device, name: cleaned };
  writeDevice(directory, renamed);
  return renamed;
}
