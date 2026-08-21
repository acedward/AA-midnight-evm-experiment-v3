# Archived 00006-unbalanced-zswap deliverables

`EXPERIMENTAL_LANE` / `LANE-DEV-1`

Project `00008-AA-v3-evm` starts from
`92f597ac07b65fb2200417839b874cf75fd793ec`, the default-branch merge containing the complete
00006 Manager v4 result. Following the existing archive convention, the 00006 top-level result is
relocated here before any 00008 product implementation so new gate output cannot overwrite its
canonical paths.

| Original path at `92f597ac07b65fb2200417839b874cf75fd793ec` | Path on this branch | Baseline Git object |
|---|---|---|
| `evidence/` | `archive/00006/evidence/` | tree `793f63101e5207aa42787cc7da9bb9bb2244213f` (407 tracked files) |
| `README.md` | `archive/00006/README.md` | blob `9f2e145d84afe94332035e8885974df8272396e3` |
| `REPORT.md` | `archive/00006/REPORT.md` | blob `d2e641b1950d19b9b75c549595a63cfca806b8fc` |
| `VERIFICATION.md` | `archive/00006/VERIFICATION.md` | blob `d8fc77b50cb148b759898629f444142d1fd50be6` |

The four relocated objects are byte-identical to the baseline. Relative links inside the archived
documents point at the original 00006 layout and may therefore be stale here. The authoritative
source state remains the pinned baseline commit above and the archived object IDs make the move
verifiable.

`archive/00003/`, `archive/00004/`, and `archive/00005/` are carried forward untouched.

Retained in place as the 00008 implementation baseline: `contracts/`, `docker/`, `harness/`, and
`scripts/`. Their inherited 00006 names may be changed only by the approved workstream that owns the
corresponding source. The Phase 0 namespace manifest at
`evidence/00008-AA-v3-evm/NAMESPACE.md` defines collision-free names for all new 00008 output.
