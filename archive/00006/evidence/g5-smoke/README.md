# G5 SMOKE — a wiring check, NOT evidence

`scripts/g5/smoke-g5.sh`, run 2026-08-20, `final_exit: 0` including teardown and the residue check.

This directory is here so nothing in it can be mistaken for a G5 result. The full matrix is hours of
stack time and the expensive failures are cheap to find, so the shipped baseline and the structurally
most different arm were run at one and two cells first. Two things came out of it, and both mattered:

1. **The live baseline reproduced F-310 on the first attempt** — `manager` GUARANTEED at ONE custody
   cell and FALLIBLE at TWO, both FR-308 shapes, with `imbalances(0) = {}` at the failing points
   (the all-or-nothing signature the mechanism predicts). `f310Reproduced: true`. Offers proved in
   5.5-10.4 s at 21.6-26.9 kB. So the rig's anchor holds and the arms have something to be measured
   against.
2. **Arm (e)'s riskiest live paths work.** `stageOffer` — which does `sendShielded` to the contract
   itself and then `Cell.writeCoin` on the resulting coin, writing TWO same-colour coins in one call —
   submitted and landed (tx `00064915dbfe…`), and `openSwap` then built and proved GUARANTEED for both
   shapes at 21.3 kB / 16.1 kB. Nothing about F-305 or the Merkle-index qualification rule blocks it.

And it caught the bug it existed to catch: at the second custody size the run died with
`failed assert: an offer is already staged | cause: Error executing circuit 'stageOffer'`. Relaxation
R5'' means a staged coin can only leave the escrow through a SETTLED `openSwap`, and this matrix
settles nothing, so re-staging per measurement point is impossible by construction. Fixed in
`harness/src/g5/matrix.ts` (stage once, reuse, and record why) before any full run — which is three
hours of shared-host time not spent discovering it at the end.

`live-matrix-SMOKE.json` / `LIVE-MATRIX-SMOKE.md` are that run's output, renamed so they cannot be
read as the gate's.
