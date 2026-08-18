// Compatibility shim. The compiled-contract wrappers moved to `src/contracts.ts` in Plan 02 (G2),
// because G2 deploys the contracts too and both gates must use ONE definition — in particular one
// `CompiledContract.make` tag, so a mismatch can never make G2's and G3's artifacts differ.
//
// The 00003-era file that lived here is superseded: its tags were `aa00003-*`, and its Minter
// wrapper predates the constructor tag (FR-101). Plan 03 owns the rest of `src/g3/`, which is still
// 00003 code and is STALE against the 00004 contracts — see the note in Plan 02 Phase 2.
export { compiledManager, compiledMinter, type ManagerPrivateState } from '../contracts.js';
