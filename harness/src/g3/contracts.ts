// G3 — wrap the compiled artifacts as compact-js `CompiledContract`s.
//
// This is the piece Finding G3-1 was missing. midnight-js v5.0.0-beta.6 does NOT take a raw
// `new Contract(witnesses)`: `DeployContractOptions.compiledContract` is a
// `CompiledContract.CompiledContract`, built by `CompiledContract.make(tag, ctor)` and then
// completed with its witnesses and compiled-asset path. Passing the raw class left the witness
// context unset, which is exactly what `compact-js`'s `getContractContext` dereferenced
// (`Cannot read properties of undefined (reading 'Symbol()')`).
// compact-js is transitive; midnight-js re-exports it on a supported subpath.
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js/effect';
import { zkDir } from './providers.js';

// @ts-ignore — generated artifact
import { Contract as MinterCtor } from '../../generated-zk/minter/contract/index.js';
// @ts-ignore — generated artifact
import { Contract as ManagerCtor } from '../../generated-zk/manager/contract/index.js';

/** Private state carried by the Manager: the owner secret its witness hands to circuits. */
export type ManagerPrivateState = { ownerSecret: Uint8Array };

/** The Minter declares no witnesses, so its witness context is explicitly vacant. */
export const compiledMinter = () =>
  (CompiledContract.make as any)('aa00003-minter', MinterCtor).pipe(
    (CompiledContract as any).withVacantWitnesses,
    (CompiledContract as any).withCompiledFileAssets(zkDir('minter')),
  );

/** The Manager's single witness returns the caller's owner secret from private state. */
export const compiledManager = () =>
  (CompiledContract.make as any)('aa00003-manager', ManagerCtor).pipe(
    (CompiledContract as any).withWitnesses({
      localOwnerSecret: (ctx: any): [ManagerPrivateState, Uint8Array] => [
        ctx.privateState,
        ctx.privateState.ownerSecret,
      ],
    }),
    (CompiledContract as any).withCompiledFileAssets(zkDir('manager')),
  );
