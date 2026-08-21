import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<PS> = {
}

export type ImpureCircuits<PS> = {
}

export type ProvableCircuits<PS> = {
}

export type PureCircuits = {
  frozenTypeHash(selector_0: bigint): Uint8Array;
  managerAlias(manager_0: Uint8Array): Uint8Array;
  accountId(manager_0: Uint8Array,
            owner_0: Uint8Array,
            accountSalt_0: Uint8Array): Uint8Array;
  domainSeparator(alias_0: Uint8Array, deploymentDomain_0: Uint8Array): Uint8Array;
  registerStructHash(manager_0: Uint8Array,
                     account_0: Uint8Array,
                     owner_0: Uint8Array,
                     accountSalt_0: Uint8Array,
                     validUntil_0: bigint): Uint8Array;
  withdrawShieldedStructHash(manager_0: Uint8Array,
                             account_0: Uint8Array,
                             owner_0: Uint8Array,
                             nonce_0: bigint,
                             validUntil_0: bigint,
                             color_0: Uint8Array,
                             amount_0: bigint,
                             recipientKind_0: bigint,
                             recipient_0: Uint8Array): Uint8Array;
  withdrawUnshieldedStructHash(manager_0: Uint8Array,
                               account_0: Uint8Array,
                               owner_0: Uint8Array,
                               nonce_0: bigint,
                               validUntil_0: bigint,
                               color_0: Uint8Array,
                               amount_0: bigint,
                               recipientKind_0: bigint,
                               recipient_0: Uint8Array): Uint8Array;
  transferShieldedStructHash(manager_0: Uint8Array,
                             account_0: Uint8Array,
                             owner_0: Uint8Array,
                             nonce_0: bigint,
                             validUntil_0: bigint,
                             toAccount_0: Uint8Array,
                             color_0: Uint8Array,
                             amount_0: bigint): Uint8Array;
  transferUnshieldedStructHash(manager_0: Uint8Array,
                               account_0: Uint8Array,
                               owner_0: Uint8Array,
                               nonce_0: bigint,
                               validUntil_0: bigint,
                               toAccount_0: Uint8Array,
                               color_0: Uint8Array,
                               amount_0: bigint): Uint8Array;
  openSwapStructHash(manager_0: Uint8Array,
                     account_0: Uint8Array,
                     owner_0: Uint8Array,
                     nonce_0: bigint,
                     validUntil_0: bigint,
                     giveColor_0: Uint8Array,
                     giveAmount_0: bigint,
                     recipientKind_0: bigint,
                     recipient_0: Uint8Array,
                     wantNonce_0: Uint8Array,
                     wantColor_0: Uint8Array,
                     wantAmount_0: bigint,
                     creditAccount_0: Uint8Array): Uint8Array;
  eip712Digest(domain_0: Uint8Array, structHash_0: Uint8Array): Uint8Array;
  semanticCommitment(preimage_0: Uint8Array): Uint8Array;
  signerAddress(pk_0: __compactRuntime.Secp256k1Point): Uint8Array;
  verifySignature(digest_0: Uint8Array,
                  signature_0: { r: bigint, s: bigint },
                  pk_0: __compactRuntime.Secp256k1Point): boolean;
  pointXBigEndian(pk_0: __compactRuntime.Secp256k1Point): Uint8Array;
  pointYBigEndian(pk_0: __compactRuntime.Secp256k1Point): Uint8Array;
}

export type Circuits<PS> = {
  frozenTypeHash(context: __compactRuntime.CircuitContext<PS>,
                 selector_0: bigint): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  managerAlias(context: __compactRuntime.CircuitContext<PS>,
               manager_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  accountId(context: __compactRuntime.CircuitContext<PS>,
            manager_0: Uint8Array,
            owner_0: Uint8Array,
            accountSalt_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  domainSeparator(context: __compactRuntime.CircuitContext<PS>,
                  alias_0: Uint8Array,
                  deploymentDomain_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  registerStructHash(context: __compactRuntime.CircuitContext<PS>,
                     manager_0: Uint8Array,
                     account_0: Uint8Array,
                     owner_0: Uint8Array,
                     accountSalt_0: Uint8Array,
                     validUntil_0: bigint): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  withdrawShieldedStructHash(context: __compactRuntime.CircuitContext<PS>,
                             manager_0: Uint8Array,
                             account_0: Uint8Array,
                             owner_0: Uint8Array,
                             nonce_0: bigint,
                             validUntil_0: bigint,
                             color_0: Uint8Array,
                             amount_0: bigint,
                             recipientKind_0: bigint,
                             recipient_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  withdrawUnshieldedStructHash(context: __compactRuntime.CircuitContext<PS>,
                               manager_0: Uint8Array,
                               account_0: Uint8Array,
                               owner_0: Uint8Array,
                               nonce_0: bigint,
                               validUntil_0: bigint,
                               color_0: Uint8Array,
                               amount_0: bigint,
                               recipientKind_0: bigint,
                               recipient_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  transferShieldedStructHash(context: __compactRuntime.CircuitContext<PS>,
                             manager_0: Uint8Array,
                             account_0: Uint8Array,
                             owner_0: Uint8Array,
                             nonce_0: bigint,
                             validUntil_0: bigint,
                             toAccount_0: Uint8Array,
                             color_0: Uint8Array,
                             amount_0: bigint): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  transferUnshieldedStructHash(context: __compactRuntime.CircuitContext<PS>,
                               manager_0: Uint8Array,
                               account_0: Uint8Array,
                               owner_0: Uint8Array,
                               nonce_0: bigint,
                               validUntil_0: bigint,
                               toAccount_0: Uint8Array,
                               color_0: Uint8Array,
                               amount_0: bigint): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  openSwapStructHash(context: __compactRuntime.CircuitContext<PS>,
                     manager_0: Uint8Array,
                     account_0: Uint8Array,
                     owner_0: Uint8Array,
                     nonce_0: bigint,
                     validUntil_0: bigint,
                     giveColor_0: Uint8Array,
                     giveAmount_0: bigint,
                     recipientKind_0: bigint,
                     recipient_0: Uint8Array,
                     wantNonce_0: Uint8Array,
                     wantColor_0: Uint8Array,
                     wantAmount_0: bigint,
                     creditAccount_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  eip712Digest(context: __compactRuntime.CircuitContext<PS>,
               domain_0: Uint8Array,
               structHash_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  semanticCommitment(context: __compactRuntime.CircuitContext<PS>,
                     preimage_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  signerAddress(context: __compactRuntime.CircuitContext<PS>,
                pk_0: __compactRuntime.Secp256k1Point): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  verifySignature(context: __compactRuntime.CircuitContext<PS>,
                  digest_0: Uint8Array,
                  signature_0: { r: bigint, s: bigint },
                  pk_0: __compactRuntime.Secp256k1Point): Promise<__compactRuntime.CircuitResults<PS, boolean>>;
  pointXBigEndian(context: __compactRuntime.CircuitContext<PS>,
                  pk_0: __compactRuntime.Secp256k1Point): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  pointYBigEndian(context: __compactRuntime.CircuitContext<PS>,
                  pk_0: __compactRuntime.Secp256k1Point): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
}

export type Ledger = {
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): Promise<__compactRuntime.ConstructorResult<PS>>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
export declare const expectedVk: Record<string, string>;
