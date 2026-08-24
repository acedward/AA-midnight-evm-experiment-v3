import { ContractLog, type LogEvent } from "@midnight-ntwrk/midnight-js-contracts";

import { bytesToHex, equalBytes, hexToBytes, type Hex32 } from "./bytes.js";

export const MANAGER_SEMANTIC_EVENT_NAME =
  "0x535c1031f585e2d7a795d0e332a97418cd8eddde40eefa214fb78a2e18812c1a" as Hex32;
export const MANAGER_SEMANTIC_EVENT_PAYLOAD_BYTES = 256;

export interface ManagerSemanticEvent {
  readonly address: string;
  readonly commitment: Hex32;
}

function flattenRawMisc(event: LogEvent): Uint8Array | undefined {
  const raw = event as LogEvent & {
    data?: { tag?: string; content?: { value?: readonly Uint8Array[] } };
  };
  const segments = raw.data?.tag === "cell" ? raw.data.content?.value : undefined;
  if (!segments) return undefined;
  const length = segments.reduce((total, segment) => total + segment.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const segment of segments) {
    output.set(segment, offset);
    offset += segment.length;
  }
  return output;
}

/** Decode and strictly identify authoritative Manager semantic events from raw call log events. */
export function extractManagerSemanticEvents(events: readonly LogEvent[]): ManagerSemanticEvent[] {
  const semanticName = hexToBytes(MANAGER_SEMANTIC_EVENT_NAME, 32);
  const output: ManagerSemanticEvent[] = [];
  const decoded = ContractLog.decodeAll(events);
  for (let index = 0; index < decoded.length; index += 1) {
    const event = decoded[index]!;
    if (event.eventType !== "misc") continue;
    let name: Uint8Array;
    let payload: Uint8Array;
    if (!event.degraded) {
      name = event.payload.name;
      payload = event.payload.payload;
    } else {
      // compact-js 2.5.5-rc.7 correctly marks the simulator's shortened Misc cell degraded. Its
      // raw prefix is still stable and contains `name || commitment`, which is all this extractor
      // accepts. A shorter prefix is ignored rather than guessed.
      const raw = flattenRawMisc(events[index]!);
      if (!raw || raw.length < 64) continue;
      name = raw.slice(0, 32);
      payload = raw.slice(32);
    }
    if (!equalBytes(name, semanticName)) continue;
    if (payload.length < 32) continue;
    output.push({
      address: event.address,
      commitment: bytesToHex(payload.slice(0, 32)) as Hex32,
    });
  }
  return output;
}
