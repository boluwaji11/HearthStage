/**
 * STG-11. The only door between a window and the application.
 *
 * Renderers run sandboxed with context isolation and no node integration, so
 * this file is the entire surface a window can reach. Four named channels, and
 * that is the whole of it: the filesystem, the database and `ipcRenderer` stay
 * on the other side, and a channel absent from the list cannot be named.
 *
 * A renderer paints church lyrics out of a local cache. It has no business
 * reaching anything further, and when STG-74 serves the remote over the network
 * this boundary is what makes that safe.
 */

import { contextBridge, ipcRenderer } from "electron";
import {
  CHANNELS,
  isIntent,
  type ControlState,
  type Intent,
  type OutputState,
  type StageBridge,
} from "@hearth/stage-protocol";

function subscribe<T>(channel: string, listener: (value: T) => void): () => void {
  const wrapped = (unused: unknown, value: T): void => listener(value);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

const bridge: StageBridge = {
  send(intent: Intent) {
    // Checked on the way out as well as on the way in. A renderer bug should
    // look like a renderer bug rather than like a malformed message in main.
    if (!isIntent(intent)) return;
    ipcRenderer.send(CHANNELS.intent, intent);
  },
  onOutputState: (listener) => subscribe<OutputState>(CHANNELS.outputState, listener),
  onControlState: (listener) => subscribe<ControlState>(CHANNELS.controlState, listener),
  hello: () => ipcRenderer.invoke(CHANNELS.hello),
};

contextBridge.exposeInMainWorld("hearth", bridge);
