// G3 — run metrics: proof latency and transaction size.
//
// Plan 04 asks the final report for real figures rather than estimates, so both are measured at
// the point they actually happen: `proveTx` is timed by wrapping the proof provider, and every
// submitted transaction is measured by serializing it. Nothing here influences the run; a metrics
// failure must never turn a green gate red, so every recorder is total.
export type ProofSample = { circuits: string; ms: number };
export type TxSample = { label: string; bytes: number };

const proofs: ProofSample[] = [];
const txs: TxSample[] = [];

export const recordProof = (circuits: string, ms: number): void => {
  proofs.push({ circuits, ms });
};

export const recordTxSize = (label: string, tx: unknown): void => {
  try {
    const bytes = (tx as any)?.serialize?.()?.length;
    if (typeof bytes === 'number') txs.push({ label, bytes });
  } catch {
    /* a metric must never break a run */
  }
};

const summarize = (xs: number[]) => {
  if (xs.length === 0) return { count: 0 };
  const sorted = [...xs].sort((a, b) => a - b);
  return {
    count: sorted.length,
    min: sorted[0],
    median: sorted[Math.floor(sorted.length / 2)],
    max: sorted[sorted.length - 1],
    mean: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
  };
};

export const metricsReport = () => ({
  proofLatencyMs: summarize(proofs.map((p) => p.ms)),
  transactionBytes: summarize(txs.map((t) => t.bytes)),
  proofs,
  transactions: txs,
});

/** Wrap a proof provider so every `proveTx` is timed. */
export const timedProofProvider = (inner: any) => ({
  ...inner,
  proveTx: async (tx: any, config?: unknown) => {
    const t0 = Date.now();
    const proven = await inner.proveTx(tx, config);
    let circuits = 'unknown';
    try {
      const intents: Map<number, any> | undefined = tx.intents;
      const names: string[] = [];
      for (const [, intent] of intents ?? new Map()) {
        for (const action of intent.actions ?? []) {
          if (action?.entryPoint !== undefined) names.push(String(action.entryPoint));
        }
      }
      if (names.length) circuits = names.join('+');
    } catch {
      /* the label is nice to have, the timing is the point */
    }
    recordProof(circuits, Date.now() - t0);
    return proven;
  },
});
