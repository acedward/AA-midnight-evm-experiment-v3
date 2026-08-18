// Wrap the compiled 00004 artifacts as compact-js `CompiledContract`s (EXPERIMENTAL_LANE).
//
// midnight-js v5.0.0-beta.6 does NOT take a raw `new Contract(witnesses)`:
// `DeployContractOptions.compiledContract` is a `CompiledContract.CompiledContract`, built by
// `CompiledContract.make(tag, ctor)` and then completed with its witnesses and compiled-asset path
// (00003 finding G3-1). compact-js is transitive; midnight-js re-exports it on a supported subpath.
//
// NOTE for the Minter (FR-101): the per-deployment TAG is a CONSTRUCTOR argument, not part of the
// compiled contract. It is passed at deploy time as `deployContract(..., { args: [tag] })` — see
// probe P2 / finding F-102 — so ONE wrapper serves all three deployments (TOKA, TOKB, TOKC).
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js/effect';
import { zkDir } from './g3/providers.js';

// @ts-ignore — generated artifact
import { Contract as MinterCtor } from '../generated-zk/minter/contract/index.js';
// @ts-ignore — generated artifact
import { Contract as ManagerCtor } from '../generated-zk/manager/contract/index.js';

/** Private state carried by the Manager: the owner secret its witness hands to circuits. */
export type ManagerPrivateState = { ownerSecret: Uint8Array };

/** The Minter declares no witnesses, so its witness context is explicitly vacant. */
export const compiledMinter = () =>
  (CompiledContract.make as any)('aa00004-minter', MinterCtor).pipe(
    (CompiledContract as any).withVacantWitnesses,
    (CompiledContract as any).withCompiledFileAssets(zkDir('minter')),
  );

/** The Manager's single witness returns the caller's owner secret from private state. */
export const compiledManager = () =>
  (CompiledContract.make as any)('aa00004-manager', ManagerCtor).pipe(
    (CompiledContract as any).withWitnesses({
      localOwnerSecret: (ctx: any): [ManagerPrivateState, Uint8Array] => [
        ctx.privateState,
        ctx.privateState.ownerSecret,
      ],
    }),
    (CompiledContract as any).withCompiledFileAssets(zkDir('manager')),
  );
