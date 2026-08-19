// Compatibility shim. The Manager state reader lives in `src/manager-view.ts` so that G2 and G3 read
// exactly the same state and cannot disagree about a cell. Same promotion 00004 made for the
// compiled-contract wrappers (`src/contracts.ts`), for the same reason: one definition.
export {
  shieldedKeyOf,
  unshieldedKeyOf,
  hex,
  mapSizes,
  readManager,
  snapshot,
  waitForManager,
  type ManagerView,
  type PooledCoin,
} from '../manager-view.js';
