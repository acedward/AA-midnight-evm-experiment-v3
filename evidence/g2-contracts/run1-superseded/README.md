# Gate run 1's S5 outputs — SUPERSEDED as a gate result, RETAINED as the F-308 discovery

`EXPERIMENTAL_LANE` / `LANE-DEV-1` · 2026-08-20

These three files are from **G2 gate run 1**, which was RED. They are kept because they are the
first live observation of lane issue 0003, and because they are a genuine triple replication of it.

All three attempts failed identically, in the T600 arm's offer BUILD:

```
FR-302 VIOLATED … segments present: [0, <intent>]   fallible-offer segments: [<intent>]
expected at segment 0: {shielded:<S_B>: -1}         observed at segment 0: {}
```

The value leg had landed in the FALLIBLE section, where no independent taker can settle it, and FR-302
failed closed rather than publish it. That is the apparatus working as designed.

They also contain the first observations of the two node codes decoded in `../g2-spikes/NODE-CODES.md`:
**239** (`NullifierAlreadyPresent`) for the intervening-deposit arm, 3/3, and **228**
(`IntentTtlExpired`) for the short-TTL arm, 3/3 — which is what corrected FR-311's predicted `104`.

Why they are superseded as a gate result:

- the retries should never have fired. The wrapper's infra matcher was broad enough to match an
  incidental rxjs timeout string, so three identical DETERMINISTIC failures were labelled VOID and
  20 minutes were spent retrying a settled outcome. The matcher was narrowed and assertion markers
  now win outright;
- S5 shared one wanted colour across its arms, so placement confounded the staleness measurement. Each
  arm now gets a fresh wanted colour;
- the boundary these runs stumbled into is properly characterised by spike **S5b** (finding F-310):
  publishability survives one shielded custody cell and not two.

The canonical run is **run 3**, whose S5 output is `../18-spike-s5.out`.
