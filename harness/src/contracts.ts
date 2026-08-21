// Wrap the compiled 00005 artifacts as compact-js `CompiledContract`s (EXPERIMENTAL_LANE).
//
// midnight-js v5.0.0-beta.6 does NOT take a raw `new Contract(witnesses)`:
// `DeployContractOptions.compiledContract` is a `CompiledContract.CompiledContract`, built by
// `CompiledContract.make(tag, ctor)` and then completed with its witnesses and compiled-asset path
// (00003 finding G3-1). compact-js is transitive; midnight-js re-exports it on a supported subpath.
//
// NOTE for both minters: the per-deployment TAG is a CONSTRUCTOR argument, not part of the compiled
// contract. It is passed at deploy time as `deployContract(..., { args: [tag] })` — 00004 probe P2 /
// finding F-102 — so ONE wrapper serves every deployment (TOKA..TOKE for the Minter, TOKX for
// MinterCollide).
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js/effect';
import { zkDir } from './g3/providers.js';

// @ts-ignore — generated artifact
import { Contract as MinterCtor } from '../generated-zk/minter/contract/index.js';
// @ts-ignore — generated artifact
import { Contract as MinterCollideCtor } from '../generated-zk/minter-collide/contract/index.js';
// @ts-ignore — generated artifact
import { Contract as ManagerCtor } from '../generated-zk/manager/contract/index.js';

/** Private state carried by the Manager: the owner secret its witness hands to circuits. */
export type ManagerPrivateState = { ownerSecret: Uint8Array };

/** The Minter declares no witnesses, so its witness context is explicitly vacant. */
export const compiledMinter = () =>
  (CompiledContract.make as any)('aa00005-minter', MinterCtor).pipe(
    (CompiledContract as any).withVacantWitnesses,
    (CompiledContract as any).withCompiledFileAssets(zkDir('minter')),
  );

/**
 * The P-COLL fixture. A SEPARATE compiled contract with its own artifact directory — which is also
 * why it needs its own `CompiledContract.make` tag even though it mirrors the Minter's circuit
 * names: proof-key resolution joins on the deployed verifier key, and these are different keys.
 */
export const compiledMinterCollide = () =>
  (CompiledContract.make as any)('aa00005-minter-collide', MinterCollideCtor).pipe(
    (CompiledContract as any).withVacantWitnesses,
    (CompiledContract as any).withCompiledFileAssets(zkDir('minter-collide')),
  );

/** The Manager's single witness returns the caller's owner secret from private state. */
export const compiledManager = () =>
  (CompiledContract.make as any)('aa00005-manager', ManagerCtor).pipe(
    (CompiledContract as any).withWitnesses({
      localOwnerSecret: (ctx: any): [ManagerPrivateState, Uint8Array] => [
        ctx.privateState,
        ctx.privateState.ownerSecret,
      ],
    }),
    (CompiledContract as any).withCompiledFileAssets(zkDir('manager')),
  );
