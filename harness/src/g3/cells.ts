// G3 — the run's checklist records. EXPERIMENTAL_LANE / LANE-DEV-1.
//
// One record per step row, negative control and probe. `render-cells.ts` joins them against the
// specification's own checklist afterwards and FAILS on any gap or any RED item, so a row the run
// never reached cannot be quietly missing from the evidence.
export type CellRecord = {
  id: string;
  label: string;
  step: number | string;
  txs: string[];
  level: 'LEDGER' | 'SDK' | 'derived';
  points: string;
  /**
   * `RECORDED` exists for exactly one situation and is allowed for exactly one checklist id:
   * FR-207's fallback rule, where a REFUSED composition must be recorded verbatim and the
   * lazy-init half proven separately, without either being conflated with the other. Everywhere
   * else the only passing status is GREEN.
   */
  status: 'GREEN' | 'RED' | 'RECORDED';
  evidence: string;
  note?: string;
};

export type CellSink = (c: CellRecord) => void;

export const makeCellSink = (into: CellRecord[]): CellSink => (c: CellRecord) => {
  into.push(c);
  console.log(`  CELL ${c.status.padEnd(5)} ${c.id} — ${c.label}`);
};
