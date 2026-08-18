// Compatibility shim. The Manager state reader moved to `src/manager-view.ts` in Plan 03 (G3),
// because G3 reads exactly the same state and both gates must use ONE definition of "what the
// Manager holds" — otherwise the two gates could disagree about a cell without anyone noticing.
//
// Same promotion Plan 02 made for the compiled-contract wrappers (`src/contracts.ts`), for the same
// reason: one definition, so two gates cannot drift apart.
export {
  balanceKeyOf,
  hex,
  readManager,
  snapshot,
  waitForManager,
  type ManagerView,
  type PooledCoin,
} from '../manager-view.js';
