import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
__compactRuntime.checkRuntimeVersion('0.18.0-rc.1');

const _descriptor_0 = __compactRuntime.CompactTypeSecp256k1Point;

const _descriptor_1 = new __compactRuntime.CompactTypeBytes(32);

const _descriptor_2 = new __compactRuntime.CompactTypeBytes(20);

const _descriptor_3 = __compactRuntime.CompactTypeSecp256k1Scalar;

class _Secp256k1EcdsaSignature_0 {
  alignment() {
    return _descriptor_3.alignment().concat(_descriptor_3.alignment());
  }
  fromValue(value_0) {
    return {
      r: _descriptor_3.fromValue(value_0),
      s: _descriptor_3.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_3.toValue(value_0.r).concat(_descriptor_3.toValue(value_0.s));
  }
}

const _descriptor_4 = new _Secp256k1EcdsaSignature_0();

const _descriptor_5 = __compactRuntime.CompactTypeBoolean;

const _descriptor_6 = new __compactRuntime.CompactTypeBytes(1024);

const _descriptor_7 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

const _descriptor_8 = new __compactRuntime.CompactTypeUnsignedInteger(340282366920938463463374607431768211455n, 16);

const _descriptor_9 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

const _descriptor_10 = __compactRuntime.CompactTypeSecp256k1Base;

const _descriptor_11 = new __compactRuntime.CompactTypeVector(32, _descriptor_9);

class _tuple_0 {
  alignment() {
    return _descriptor_11.alignment().concat(_descriptor_11.alignment());
  }
  fromValue(value_0) {
    return [
      _descriptor_11.fromValue(value_0),
      _descriptor_11.fromValue(value_0)
    ]
  }
  toValue(value_0) {
    return _descriptor_11.toValue(value_0[0]).concat(_descriptor_11.toValue(value_0[1]));
  }
}

const _descriptor_12 = new _tuple_0();

const _descriptor_13 = new __compactRuntime.CompactTypeBytes(448);

const _descriptor_14 = new __compactRuntime.CompactTypeBytes(66);

const _descriptor_15 = new __compactRuntime.CompactTypeBytes(320);

const _descriptor_16 = new __compactRuntime.CompactTypeBytes(288);

const _descriptor_17 = new __compactRuntime.CompactTypeBytes(160);

const _descriptor_18 = new __compactRuntime.CompactTypeBytes(192);

const _descriptor_19 = new __compactRuntime.CompactTypeBytes(128);

class _Either_0 {
  alignment() {
    return _descriptor_5.alignment().concat(_descriptor_1.alignment().concat(_descriptor_1.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_5.fromValue(value_0),
      left: _descriptor_1.fromValue(value_0),
      right: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_5.toValue(value_0.is_left).concat(_descriptor_1.toValue(value_0.left).concat(_descriptor_1.toValue(value_0.right)));
  }
}

const _descriptor_20 = new _Either_0();

class _ContractAddress_0 {
  alignment() {
    return _descriptor_1.alignment();
  }
  fromValue(value_0) {
    return {
      bytes: _descriptor_1.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_1.toValue(value_0.bytes);
  }
}

const _descriptor_21 = new _ContractAddress_0();

const _descriptor_22 = new __compactRuntime.CompactTypeUnsignedInteger(4294967295n, 4);

export class Contract {
  witnesses;
  constructor(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract constructor: expected 1 argument, received ${args_0.length}`);
    }
    const witnesses_0 = args_0[0];
    if (typeof(witnesses_0) !== 'object') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor is not an object');
    }
    this.witnesses = witnesses_0;
    this.circuits = {
      async frozenTypeHash(context, ...args_1) {
        return { result: pureCircuits.frozenTypeHash(...args_1), context };
      },
      async managerAlias(context, ...args_1) {
        return { result: pureCircuits.managerAlias(...args_1), context };
      },
      async accountId(context, ...args_1) {
        return { result: pureCircuits.accountId(...args_1), context };
      },
      async domainSeparator(context, ...args_1) {
        return { result: pureCircuits.domainSeparator(...args_1), context };
      },
      async registerStructHash(context, ...args_1) {
        return { result: pureCircuits.registerStructHash(...args_1), context };
      },
      async withdrawShieldedStructHash(context, ...args_1) {
        return { result: pureCircuits.withdrawShieldedStructHash(...args_1), context };
      },
      async withdrawUnshieldedStructHash(context, ...args_1) {
        return { result: pureCircuits.withdrawUnshieldedStructHash(...args_1), context };
      },
      async transferShieldedStructHash(context, ...args_1) {
        return { result: pureCircuits.transferShieldedStructHash(...args_1), context };
      },
      async transferUnshieldedStructHash(context, ...args_1) {
        return { result: pureCircuits.transferUnshieldedStructHash(...args_1), context };
      },
      async openSwapStructHash(context, ...args_1) {
        return { result: pureCircuits.openSwapStructHash(...args_1), context };
      },
      async eip712Digest(context, ...args_1) {
        return { result: pureCircuits.eip712Digest(...args_1), context };
      },
      async semanticCommitment(context, ...args_1) {
        return { result: pureCircuits.semanticCommitment(...args_1), context };
      },
      async signerAddress(context, ...args_1) {
        return { result: pureCircuits.signerAddress(...args_1), context };
      },
      async verifySignature(context, ...args_1) {
        return { result: pureCircuits.verifySignature(...args_1), context };
      },
      async pointXBigEndian(context, ...args_1) {
        return { result: pureCircuits.pointXBigEndian(...args_1), context };
      },
      async pointYBigEndian(context, ...args_1) {
        return { result: pureCircuits.pointYBigEndian(...args_1), context };
      }
    };
    this.impureCircuits = {};
    this.provableCircuits = {};
  }
  async initialState(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const constructorContext_0 = args_0[0];
    if (typeof(constructorContext_0) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'constructorContext' in argument 1 (as invoked from Typescript) to be an object`);
    }
    if (!('initialZswapLocalState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript)`);
    }
    if (typeof(constructorContext_0.initialZswapLocalState) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript) to be an object`);
    }
    const state_0 = new __compactRuntime.ContractState();
    let stateValue_0 = __compactRuntime.StateValue.newArray();
    state_0.data = new __compactRuntime.ChargedState(stateValue_0);
    const context = __compactRuntime.createCircuitContext('constructor', __compactRuntime.dummyContractAddress(), constructorContext_0.initialZswapLocalState.coinPublicKey, state_0.data, constructorContext_0.initialPrivateState);
    const partialProofData = {
      input: { value: [], alignment: [] },
      output: undefined,
      publicTranscript: [],
      privateTranscriptOutputs: []
    };
    state_0.data = new __compactRuntime.ChargedState(context.callContext.currentQueryContext.state.state);
    return {
      currentContractState: state_0,
      currentPrivateState: context.callContext.currentPrivateState,
      currentZswapLocalState: context.callContext.currentZswapLocalState
    }
  }
  _hashToSecp256k1Scalar_0(digest_0) {
    const v_0 = Array.from(digest_0, BigInt);
    const beReversed_0 = Uint8Array.from([v_0[31],
                                          v_0[30],
                                          v_0[29],
                                          v_0[28],
                                          v_0[27],
                                          v_0[26],
                                          v_0[25],
                                          v_0[24],
                                          v_0[23],
                                          v_0[22],
                                          v_0[21],
                                          v_0[20],
                                          v_0[19],
                                          v_0[18],
                                          v_0[17],
                                          v_0[16],
                                          v_0[15],
                                          v_0[14],
                                          v_0[13],
                                          v_0[12],
                                          v_0[11],
                                          v_0[10],
                                          v_0[9],
                                          v_0[8],
                                          v_0[7],
                                          v_0[6],
                                          v_0[5],
                                          v_0[4],
                                          v_0[3],
                                          v_0[2],
                                          v_0[1],
                                          v_0[0]],
                                         Number);
    return __compactRuntime.convertBytesToField(115792089237316195423570985008687907852837564279074904382605163141518161494336n,
                                                32,
                                                beReversed_0,
                                                'Secp256k1Scalar',
                                                '<standard library>');
  }
  _secp256k1EcdsaVerify_0(msgHash_0, sig_0, pk_0) {
    const z_0 = this._hashToSecp256k1Scalar_0(msgHash_0);
    const __compact_pattern_tmp1_0 = sig_0;
    const r_0 = __compact_pattern_tmp1_0.r;
    const s_0 = __compact_pattern_tmp1_0.s;
    const w_0 = this._inv_0(s_0);
    const u1_0 = this._mul_0(z_0, w_0);
    const u2_0 = this._mul_0(r_0, w_0);
    const point_0 = this._ecAdd_0(this._ecMulGenerator_0(u1_0),
                                  this._ecMul_0(pk_0, u2_0));
    return __compactRuntime.convertBytesToField(115792089237316195423570985008687907852837564279074904382605163141518161494336n,
                                                32,
                                                __compactRuntime.convertBigintToBytes(32,
                                                                                      this._secp256k1PointX_0(point_0),
                                                                                      '<standard library>'),
                                                'Secp256k1Scalar',
                                                '<standard library>')
           ===
           r_0;
  }
  _secp256k1BaseBigEndian_0(b_0) {
    const vec_0 = Array.from(__compactRuntime.convertBigintToBytes(32,
                                                                   b_0,
                                                                   '<standard library>'),
                             BigInt);
    return [vec_0[31],
            vec_0[30],
            vec_0[29],
            vec_0[28],
            vec_0[27],
            vec_0[26],
            vec_0[25],
            vec_0[24],
            vec_0[23],
            vec_0[22],
            vec_0[21],
            vec_0[20],
            vec_0[19],
            vec_0[18],
            vec_0[17],
            vec_0[16],
            vec_0[15],
            vec_0[14],
            vec_0[13],
            vec_0[12],
            vec_0[11],
            vec_0[10],
            vec_0[9],
            vec_0[8],
            vec_0[7],
            vec_0[6],
            vec_0[5],
            vec_0[4],
            vec_0[3],
            vec_0[2],
            vec_0[1],
            vec_0[0]];
  }
  _secp256k1EthereumAddress_0(pk_0) {
    __compactRuntime.assert(!this._equal_0(pk_0,
                                           ({x: 0n, y: 0n, identity: true})),
                            'Cannot compute the address for the point at infinity');
    const hash_0 = this._keccak256_9([this._secp256k1BaseBigEndian_0(this._secp256k1PointX_0(pk_0)),
                                      this._secp256k1BaseBigEndian_0(this._secp256k1PointY_0(pk_0))]);
    return ((e, i) => e.slice(i, i+20))(hash_0, Number(12n));
  }
  _keccak256_0(value_0) {
    const result_0 = __compactRuntime.keccak256(_descriptor_1, value_0);
    return result_0;
  }
  _keccak256_1(value_0) {
    const result_0 = __compactRuntime.keccak256(_descriptor_19, value_0);
    return result_0;
  }
  _keccak256_2(value_0) {
    const result_0 = __compactRuntime.keccak256(_descriptor_17, value_0);
    return result_0;
  }
  _keccak256_3(value_0) {
    const result_0 = __compactRuntime.keccak256(_descriptor_18, value_0);
    return result_0;
  }
  _keccak256_4(value_0) {
    const result_0 = __compactRuntime.keccak256(_descriptor_15, value_0);
    return result_0;
  }
  _keccak256_5(value_0) {
    const result_0 = __compactRuntime.keccak256(_descriptor_16, value_0);
    return result_0;
  }
  _keccak256_6(value_0) {
    const result_0 = __compactRuntime.keccak256(_descriptor_13, value_0);
    return result_0;
  }
  _keccak256_7(value_0) {
    const result_0 = __compactRuntime.keccak256(_descriptor_14, value_0);
    return result_0;
  }
  _keccak256_8(value_0) {
    const result_0 = __compactRuntime.keccak256(_descriptor_6, value_0);
    return result_0;
  }
  _keccak256_9(value_0) {
    const result_0 = __compactRuntime.keccak256(_descriptor_12, value_0);
    return result_0;
  }
  _mul_0(x_0, y_0) {
    const result_0 = __compactRuntime.secp256k1ScalarMul(x_0, y_0);
    return result_0;
  }
  _inv_0(s_0) {
    const result_0 = __compactRuntime.secp256k1ScalarInv(s_0);
    return result_0;
  }
  _secp256k1PointX_0(pt_0) {
    const result_0 = __compactRuntime.secp256k1PointX(pt_0);
    return result_0;
  }
  _secp256k1PointY_0(pt_0) {
    const result_0 = __compactRuntime.secp256k1PointY(pt_0);
    return result_0;
  }
  _ecAdd_0(a_0, b_0) {
    const result_0 = __compactRuntime.secp256k1Add(a_0, b_0);
    return result_0;
  }
  _ecMul_0(a_0, b_0) {
    const result_0 = __compactRuntime.secp256k1Mul(a_0, b_0);
    return result_0;
  }
  _ecMulGenerator_0(b_0) {
    const result_0 = __compactRuntime.secp256k1MulGenerator(b_0);
    return result_0;
  }
  _reverseBytes32_0(value_0) {
    return Uint8Array.from([BigInt(value_0[31n]),
                            BigInt(value_0[30n]),
                            BigInt(value_0[29n]),
                            BigInt(value_0[28n]),
                            BigInt(value_0[27n]),
                            BigInt(value_0[26n]),
                            BigInt(value_0[25n]),
                            BigInt(value_0[24n]),
                            BigInt(value_0[23n]),
                            BigInt(value_0[22n]),
                            BigInt(value_0[21n]),
                            BigInt(value_0[20n]),
                            BigInt(value_0[19n]),
                            BigInt(value_0[18n]),
                            BigInt(value_0[17n]),
                            BigInt(value_0[16n]),
                            BigInt(value_0[15n]),
                            BigInt(value_0[14n]),
                            BigInt(value_0[13n]),
                            BigInt(value_0[12n]),
                            BigInt(value_0[11n]),
                            BigInt(value_0[10n]),
                            BigInt(value_0[9n]),
                            BigInt(value_0[8n]),
                            BigInt(value_0[7n]),
                            BigInt(value_0[6n]),
                            BigInt(value_0[5n]),
                            BigInt(value_0[4n]),
                            BigInt(value_0[3n]),
                            BigInt(value_0[2n]),
                            BigInt(value_0[1n]),
                            BigInt(value_0[0n])],
                           Number);
  }
  _uint64Word_0(value_0) {
    return this._reverseBytes32_0(__compactRuntime.convertBigintToBytes(32,
                                                                        value_0,
                                                                        'AuthCodec.compact line 20 char 25'));
  }
  _uint128Word_0(value_0) {
    return this._reverseBytes32_0(__compactRuntime.convertBigintToBytes(32,
                                                                        value_0,
                                                                        'AuthCodec.compact line 24 char 25'));
  }
  _uint8Word_0(value_0) {
    return this._reverseBytes32_0(__compactRuntime.convertBigintToBytes(32,
                                                                        value_0,
                                                                        'AuthCodec.compact line 28 char 25'));
  }
  _addressWord_0(value_0) {
    return Uint8Array.from(((e) => e.slice(0, 32))([...Array.from(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
                                                                  BigInt),
                                                    ...Array.from(value_0,
                                                                  BigInt)]),
                           Number);
  }
  _accountTag_0() {
    return Uint8Array.from([85n,
                            188n,
                            148n,
                            15n,
                            131n,
                            83n,
                            55n,
                            241n,
                            34n,
                            76n,
                            24n,
                            17n,
                            16n,
                            178n,
                            183n,
                            127n,
                            87n,
                            237n,
                            105n,
                            76n,
                            174n,
                            12n,
                            75n,
                            248n,
                            255n,
                            107n,
                            179n,
                            224n,
                            59n,
                            230n,
                            169n,
                            136n],
                           Number);
  }
  _domainType_0() {
    return Uint8Array.from([54n,
                            194n,
                            93n,
                            227n,
                            229n,
                            65n,
                            213n,
                            217n,
                            112n,
                            246n,
                            110n,
                            66n,
                            16n,
                            215n,
                            40n,
                            114n,
                            18n,
                            32n,
                            255n,
                            245n,
                            192n,
                            119n,
                            204n,
                            108n,
                            208n,
                            8n,
                            179n,
                            160n,
                            198n,
                            42n,
                            218n,
                            183n],
                           Number);
  }
  _domainName_0() {
    return Uint8Array.from([178n,
                            161n,
                            97n,
                            193n,
                            225n,
                            254n,
                            9n,
                            246n,
                            49n,
                            88n,
                            91n,
                            59n,
                            218n,
                            14n,
                            74n,
                            34n,
                            243n,
                            23n,
                            215n,
                            198n,
                            99n,
                            197n,
                            130n,
                            160n,
                            124n,
                            29n,
                            104n,
                            62n,
                            97n,
                            253n,
                            205n,
                            177n],
                           Number);
  }
  _domainVersion_0() {
    return Uint8Array.from([200n,
                            158n,
                            253n,
                            170n,
                            84n,
                            192n,
                            242n,
                            12n,
                            122n,
                            223n,
                            97n,
                            40n,
                            130n,
                            223n,
                            9n,
                            80n,
                            245n,
                            169n,
                            81n,
                            99n,
                            126n,
                            3n,
                            7n,
                            205n,
                            203n,
                            76n,
                            103n,
                            47n,
                            41n,
                            139n,
                            139n,
                            198n],
                           Number);
  }
  _registerType_0() {
    return Uint8Array.from([230n,
                            172n,
                            230n,
                            199n,
                            10n,
                            157n,
                            146n,
                            239n,
                            133n,
                            28n,
                            46n,
                            42n,
                            103n,
                            178n,
                            48n,
                            144n,
                            23n,
                            176n,
                            81n,
                            211n,
                            158n,
                            5n,
                            84n,
                            199n,
                            70n,
                            39n,
                            74n,
                            23n,
                            105n,
                            89n,
                            172n,
                            79n],
                           Number);
  }
  _withdrawShieldedType_0() {
    return Uint8Array.from([113n,
                            126n,
                            30n,
                            116n,
                            18n,
                            152n,
                            82n,
                            189n,
                            67n,
                            103n,
                            68n,
                            165n,
                            161n,
                            16n,
                            143n,
                            13n,
                            185n,
                            2n,
                            146n,
                            112n,
                            49n,
                            245n,
                            231n,
                            121n,
                            150n,
                            24n,
                            236n,
                            18n,
                            147n,
                            102n,
                            214n,
                            30n],
                           Number);
  }
  _withdrawUnshieldedType_0() {
    return Uint8Array.from([182n,
                            1n,
                            41n,
                            234n,
                            108n,
                            164n,
                            193n,
                            181n,
                            29n,
                            134n,
                            96n,
                            119n,
                            209n,
                            28n,
                            219n,
                            2n,
                            48n,
                            230n,
                            6n,
                            88n,
                            118n,
                            165n,
                            66n,
                            6n,
                            254n,
                            206n,
                            4n,
                            65n,
                            62n,
                            218n,
                            186n,
                            157n],
                           Number);
  }
  _transferShieldedType_0() {
    return Uint8Array.from([6n,
                            190n,
                            184n,
                            62n,
                            200n,
                            222n,
                            211n,
                            168n,
                            8n,
                            11n,
                            250n,
                            181n,
                            145n,
                            216n,
                            154n,
                            27n,
                            134n,
                            237n,
                            158n,
                            63n,
                            141n,
                            246n,
                            193n,
                            14n,
                            211n,
                            103n,
                            116n,
                            22n,
                            208n,
                            165n,
                            96n,
                            100n],
                           Number);
  }
  _transferUnshieldedType_0() {
    return Uint8Array.from([70n,
                            233n,
                            111n,
                            68n,
                            150n,
                            193n,
                            130n,
                            233n,
                            131n,
                            149n,
                            182n,
                            137n,
                            112n,
                            26n,
                            148n,
                            92n,
                            189n,
                            180n,
                            117n,
                            67n,
                            87n,
                            66n,
                            66n,
                            204n,
                            23n,
                            249n,
                            182n,
                            68n,
                            140n,
                            4n,
                            154n,
                            7n],
                           Number);
  }
  _openSwapType_0() {
    return Uint8Array.from([247n,
                            135n,
                            215n,
                            249n,
                            99n,
                            232n,
                            158n,
                            252n,
                            218n,
                            142n,
                            106n,
                            84n,
                            107n,
                            175n,
                            255n,
                            51n,
                            56n,
                            140n,
                            189n,
                            244n,
                            75n,
                            129n,
                            246n,
                            245n,
                            149n,
                            12n,
                            75n,
                            211n,
                            176n,
                            102n,
                            88n,
                            72n],
                           Number);
  }
  _frozenTypeHash_0(selector_0) {
    if (selector_0 === 1n) {
      return this._registerType_0();
    } else {
      if (selector_0 === 2n) {
        return this._withdrawShieldedType_0();
      } else {
        if (selector_0 === 3n) {
          return this._withdrawUnshieldedType_0();
        } else {
          if (selector_0 === 4n) {
            return this._transferShieldedType_0();
          } else {
            if (selector_0 === 5n) {
              return this._transferUnshieldedType_0();
            } else {
              __compactRuntime.assert(selector_0 === 6n,
                                      'AuthCodec: selector must be 1..6');
              return this._openSwapType_0();
            }
          }
        }
      }
    }
  }
  _managerAlias_0(manager_0) {
    return ((e, i) => e.slice(i, i+20))(this._keccak256_0(manager_0),
                                        Number(12n));
  }
  _accountId_0(manager_0, owner_0, accountSalt_0) {
    const preimage_0 = Uint8Array.from(((e) => e.slice(0, 128))([...Array.from(this._accountTag_0(),
                                                                               BigInt),
                                                                 ...Array.from(manager_0,
                                                                               BigInt),
                                                                 ...Array.from(this._addressWord_0(owner_0),
                                                                               BigInt),
                                                                 ...Array.from(accountSalt_0,
                                                                               BigInt)]),
                                       Number);
    return this._keccak256_1(preimage_0);
  }
  _domainSeparator_0(alias_0, deploymentDomain_0) {
    const preimage_0 = Uint8Array.from(((e) => e.slice(0, 160))([...Array.from(this._domainType_0(),
                                                                               BigInt),
                                                                 ...Array.from(this._domainName_0(),
                                                                               BigInt),
                                                                 ...Array.from(this._domainVersion_0(),
                                                                               BigInt),
                                                                 ...Array.from(this._addressWord_0(alias_0),
                                                                               BigInt),
                                                                 ...Array.from(deploymentDomain_0,
                                                                               BigInt)]),
                                       Number);
    return this._keccak256_2(preimage_0);
  }
  _registerStructHash_0(manager_0,
                        account_0,
                        owner_0,
                        accountSalt_0,
                        validUntil_0)
  {
    const preimage_0 = Uint8Array.from(((e) => e.slice(0, 192))([...Array.from(this._registerType_0(),
                                                                               BigInt),
                                                                 ...Array.from(manager_0,
                                                                               BigInt),
                                                                 ...Array.from(account_0,
                                                                               BigInt),
                                                                 ...Array.from(this._addressWord_0(owner_0),
                                                                               BigInt),
                                                                 ...Array.from(accountSalt_0,
                                                                               BigInt),
                                                                 ...Array.from(this._uint64Word_0(validUntil_0),
                                                                               BigInt)]),
                                       Number);
    return this._keccak256_3(preimage_0);
  }
  _withdrawShieldedStructHash_0(manager_0,
                                account_0,
                                owner_0,
                                nonce_0,
                                validUntil_0,
                                color_0,
                                amount_0,
                                recipientKind_0,
                                recipient_0)
  {
    const preimage_0 = Uint8Array.from(((e) => e.slice(0, 320))([...Array.from(this._withdrawShieldedType_0(),
                                                                               BigInt),
                                                                 ...Array.from(manager_0,
                                                                               BigInt),
                                                                 ...Array.from(account_0,
                                                                               BigInt),
                                                                 ...Array.from(this._addressWord_0(owner_0),
                                                                               BigInt),
                                                                 ...Array.from(this._uint64Word_0(nonce_0),
                                                                               BigInt),
                                                                 ...Array.from(this._uint64Word_0(validUntil_0),
                                                                               BigInt),
                                                                 ...Array.from(color_0,
                                                                               BigInt),
                                                                 ...Array.from(this._uint128Word_0(amount_0),
                                                                               BigInt),
                                                                 ...Array.from(this._uint8Word_0(recipientKind_0),
                                                                               BigInt),
                                                                 ...Array.from(recipient_0,
                                                                               BigInt)]),
                                       Number);
    return this._keccak256_4(preimage_0);
  }
  _withdrawUnshieldedStructHash_0(manager_0,
                                  account_0,
                                  owner_0,
                                  nonce_0,
                                  validUntil_0,
                                  color_0,
                                  amount_0,
                                  recipientKind_0,
                                  recipient_0)
  {
    const preimage_0 = Uint8Array.from(((e) => e.slice(0, 320))([...Array.from(this._withdrawUnshieldedType_0(),
                                                                               BigInt),
                                                                 ...Array.from(manager_0,
                                                                               BigInt),
                                                                 ...Array.from(account_0,
                                                                               BigInt),
                                                                 ...Array.from(this._addressWord_0(owner_0),
                                                                               BigInt),
                                                                 ...Array.from(this._uint64Word_0(nonce_0),
                                                                               BigInt),
                                                                 ...Array.from(this._uint64Word_0(validUntil_0),
                                                                               BigInt),
                                                                 ...Array.from(color_0,
                                                                               BigInt),
                                                                 ...Array.from(this._uint128Word_0(amount_0),
                                                                               BigInt),
                                                                 ...Array.from(this._uint8Word_0(recipientKind_0),
                                                                               BigInt),
                                                                 ...Array.from(recipient_0,
                                                                               BigInt)]),
                                       Number);
    return this._keccak256_4(preimage_0);
  }
  _transferShieldedStructHash_0(manager_0,
                                account_0,
                                owner_0,
                                nonce_0,
                                validUntil_0,
                                toAccount_0,
                                color_0,
                                amount_0)
  {
    const preimage_0 = Uint8Array.from(((e) => e.slice(0, 288))([...Array.from(this._transferShieldedType_0(),
                                                                               BigInt),
                                                                 ...Array.from(manager_0,
                                                                               BigInt),
                                                                 ...Array.from(account_0,
                                                                               BigInt),
                                                                 ...Array.from(this._addressWord_0(owner_0),
                                                                               BigInt),
                                                                 ...Array.from(this._uint64Word_0(nonce_0),
                                                                               BigInt),
                                                                 ...Array.from(this._uint64Word_0(validUntil_0),
                                                                               BigInt),
                                                                 ...Array.from(toAccount_0,
                                                                               BigInt),
                                                                 ...Array.from(color_0,
                                                                               BigInt),
                                                                 ...Array.from(this._uint128Word_0(amount_0),
                                                                               BigInt)]),
                                       Number);
    return this._keccak256_5(preimage_0);
  }
  _transferUnshieldedStructHash_0(manager_0,
                                  account_0,
                                  owner_0,
                                  nonce_0,
                                  validUntil_0,
                                  toAccount_0,
                                  color_0,
                                  amount_0)
  {
    const preimage_0 = Uint8Array.from(((e) => e.slice(0, 288))([...Array.from(this._transferUnshieldedType_0(),
                                                                               BigInt),
                                                                 ...Array.from(manager_0,
                                                                               BigInt),
                                                                 ...Array.from(account_0,
                                                                               BigInt),
                                                                 ...Array.from(this._addressWord_0(owner_0),
                                                                               BigInt),
                                                                 ...Array.from(this._uint64Word_0(nonce_0),
                                                                               BigInt),
                                                                 ...Array.from(this._uint64Word_0(validUntil_0),
                                                                               BigInt),
                                                                 ...Array.from(toAccount_0,
                                                                               BigInt),
                                                                 ...Array.from(color_0,
                                                                               BigInt),
                                                                 ...Array.from(this._uint128Word_0(amount_0),
                                                                               BigInt)]),
                                       Number);
    return this._keccak256_5(preimage_0);
  }
  _openSwapStructHash_0(manager_0,
                        account_0,
                        owner_0,
                        nonce_0,
                        validUntil_0,
                        giveColor_0,
                        giveAmount_0,
                        recipientKind_0,
                        recipient_0,
                        wantNonce_0,
                        wantColor_0,
                        wantAmount_0,
                        creditAccount_0)
  {
    const preimage_0 = Uint8Array.from(((e) => e.slice(0, 448))([...Array.from(this._openSwapType_0(),
                                                                               BigInt),
                                                                 ...Array.from(manager_0,
                                                                               BigInt),
                                                                 ...Array.from(account_0,
                                                                               BigInt),
                                                                 ...Array.from(this._addressWord_0(owner_0),
                                                                               BigInt),
                                                                 ...Array.from(this._uint64Word_0(nonce_0),
                                                                               BigInt),
                                                                 ...Array.from(this._uint64Word_0(validUntil_0),
                                                                               BigInt),
                                                                 ...Array.from(giveColor_0,
                                                                               BigInt),
                                                                 ...Array.from(this._uint128Word_0(giveAmount_0),
                                                                               BigInt),
                                                                 ...Array.from(this._uint8Word_0(recipientKind_0),
                                                                               BigInt),
                                                                 ...Array.from(recipient_0,
                                                                               BigInt),
                                                                 ...Array.from(wantNonce_0,
                                                                               BigInt),
                                                                 ...Array.from(wantColor_0,
                                                                               BigInt),
                                                                 ...Array.from(this._uint128Word_0(wantAmount_0),
                                                                               BigInt),
                                                                 ...Array.from(creditAccount_0,
                                                                               BigInt)]),
                                       Number);
    return this._keccak256_6(preimage_0);
  }
  _eip712Digest_0(domain_0, structHash_0) {
    const eipPrefix_0 = Uint8Array.from([25n, 1n], Number);
    const preimage_0 = Uint8Array.from(((e) => e.slice(0, 66))([...Array.from(eipPrefix_0,
                                                                              BigInt),
                                                                ...Array.from(domain_0,
                                                                              BigInt),
                                                                ...Array.from(structHash_0,
                                                                              BigInt)]),
                                       Number);
    return this._keccak256_7(preimage_0);
  }
  _semanticCommitment_0(preimage_0) { return this._keccak256_8(preimage_0); }
  _signerAddress_0(pk_0) { return this._secp256k1EthereumAddress_0(pk_0); }
  _verifySignature_0(digest_0, signature_0, pk_0) {
    return this._secp256k1EcdsaVerify_0(digest_0, signature_0, pk_0);
  }
  _pointXBigEndian_0(pk_0) {
    return this._reverseBytes32_0(__compactRuntime.convertBigintToBytes(32,
                                                                        this._secp256k1PointX_0(pk_0),
                                                                        'AuthCodec.compact line 263 char 34'));
  }
  _pointYBigEndian_0(pk_0) {
    return this._reverseBytes32_0(__compactRuntime.convertBigintToBytes(32,
                                                                        this._secp256k1PointY_0(pk_0),
                                                                        'AuthCodec.compact line 267 char 34'));
  }
  _equal_0(x0, y0) {
    if (x0.identity) { return y0.identity; }
    if (y0.identity || x0.x != y0.x || x0.y != y0.y) {
      return false;
    }
    return true;
  }
}
export function ledger(stateOrChargedState) {
  const state = stateOrChargedState instanceof __compactRuntime.StateValue ? stateOrChargedState : stateOrChargedState.state;
  const chargedState = stateOrChargedState instanceof __compactRuntime.StateValue ? new __compactRuntime.ChargedState(stateOrChargedState) : stateOrChargedState;
  const context = {
    callContext: { currentQueryContext: new __compactRuntime.QueryContext(chargedState, __compactRuntime.dummyContractAddress()), currentGasCost: __compactRuntime.emptyRunningCost() },
    costModel: __compactRuntime.CostModel.initialCostModel()
  };
  const partialProofData = {
    input: { value: [], alignment: [] },
    output: undefined,
    publicTranscript: [],
    privateTranscriptOutputs: []
  };
  return {
  };
}
const _emptyContext = {
  callContext: { currentQueryContext: new __compactRuntime.QueryContext(new __compactRuntime.ContractState().data, __compactRuntime.dummyContractAddress()), currentGasCost: __compactRuntime.emptyRunningCost() }
};
const _dummyContract = new Contract({ });
export const pureCircuits = {
  frozenTypeHash: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`frozenTypeHash: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const selector_0 = args_0[0];
    if (!(typeof(selector_0) === 'bigint' && selector_0 >= 0n && selector_0 <= 255n)) {
      __compactRuntime.typeError('frozenTypeHash',
                                 'argument 1',
                                 'AuthCodec.compact line 125 char 1',
                                 'Uint<0..256>',
                                 selector_0)
    }
    return _dummyContract._frozenTypeHash_0(selector_0);
  },
  managerAlias: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`managerAlias: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const manager_0 = args_0[0];
    if (!(manager_0.buffer instanceof ArrayBuffer && manager_0.BYTES_PER_ELEMENT === 1 && manager_0.length === 32)) {
      __compactRuntime.typeError('managerAlias',
                                 'argument 1',
                                 'AuthCodec.compact line 135 char 1',
                                 'Bytes<32>',
                                 manager_0)
    }
    return _dummyContract._managerAlias_0(manager_0);
  },
  accountId: (...args_0) => {
    if (args_0.length !== 3) {
      throw new __compactRuntime.CompactError(`accountId: expected 3 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const manager_0 = args_0[0];
    const owner_0 = args_0[1];
    const accountSalt_0 = args_0[2];
    if (!(manager_0.buffer instanceof ArrayBuffer && manager_0.BYTES_PER_ELEMENT === 1 && manager_0.length === 32)) {
      __compactRuntime.typeError('accountId',
                                 'argument 1',
                                 'AuthCodec.compact line 139 char 1',
                                 'Bytes<32>',
                                 manager_0)
    }
    if (!(owner_0.buffer instanceof ArrayBuffer && owner_0.BYTES_PER_ELEMENT === 1 && owner_0.length === 20)) {
      __compactRuntime.typeError('accountId',
                                 'argument 2',
                                 'AuthCodec.compact line 139 char 1',
                                 'Bytes<20>',
                                 owner_0)
    }
    if (!(accountSalt_0.buffer instanceof ArrayBuffer && accountSalt_0.BYTES_PER_ELEMENT === 1 && accountSalt_0.length === 32)) {
      __compactRuntime.typeError('accountId',
                                 'argument 3',
                                 'AuthCodec.compact line 139 char 1',
                                 'Bytes<32>',
                                 accountSalt_0)
    }
    return _dummyContract._accountId_0(manager_0, owner_0, accountSalt_0);
  },
  domainSeparator: (...args_0) => {
    if (args_0.length !== 2) {
      throw new __compactRuntime.CompactError(`domainSeparator: expected 2 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const alias_0 = args_0[0];
    const deploymentDomain_0 = args_0[1];
    if (!(alias_0.buffer instanceof ArrayBuffer && alias_0.BYTES_PER_ELEMENT === 1 && alias_0.length === 20)) {
      __compactRuntime.typeError('domainSeparator',
                                 'argument 1',
                                 'AuthCodec.compact line 150 char 1',
                                 'Bytes<20>',
                                 alias_0)
    }
    if (!(deploymentDomain_0.buffer instanceof ArrayBuffer && deploymentDomain_0.BYTES_PER_ELEMENT === 1 && deploymentDomain_0.length === 32)) {
      __compactRuntime.typeError('domainSeparator',
                                 'argument 2',
                                 'AuthCodec.compact line 150 char 1',
                                 'Bytes<32>',
                                 deploymentDomain_0)
    }
    return _dummyContract._domainSeparator_0(alias_0, deploymentDomain_0);
  },
  registerStructHash: (...args_0) => {
    if (args_0.length !== 5) {
      throw new __compactRuntime.CompactError(`registerStructHash: expected 5 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const manager_0 = args_0[0];
    const account_0 = args_0[1];
    const owner_0 = args_0[2];
    const accountSalt_0 = args_0[3];
    const validUntil_0 = args_0[4];
    if (!(manager_0.buffer instanceof ArrayBuffer && manager_0.BYTES_PER_ELEMENT === 1 && manager_0.length === 32)) {
      __compactRuntime.typeError('registerStructHash',
                                 'argument 1',
                                 'AuthCodec.compact line 160 char 1',
                                 'Bytes<32>',
                                 manager_0)
    }
    if (!(account_0.buffer instanceof ArrayBuffer && account_0.BYTES_PER_ELEMENT === 1 && account_0.length === 32)) {
      __compactRuntime.typeError('registerStructHash',
                                 'argument 2',
                                 'AuthCodec.compact line 160 char 1',
                                 'Bytes<32>',
                                 account_0)
    }
    if (!(owner_0.buffer instanceof ArrayBuffer && owner_0.BYTES_PER_ELEMENT === 1 && owner_0.length === 20)) {
      __compactRuntime.typeError('registerStructHash',
                                 'argument 3',
                                 'AuthCodec.compact line 160 char 1',
                                 'Bytes<20>',
                                 owner_0)
    }
    if (!(accountSalt_0.buffer instanceof ArrayBuffer && accountSalt_0.BYTES_PER_ELEMENT === 1 && accountSalt_0.length === 32)) {
      __compactRuntime.typeError('registerStructHash',
                                 'argument 4',
                                 'AuthCodec.compact line 160 char 1',
                                 'Bytes<32>',
                                 accountSalt_0)
    }
    if (!(typeof(validUntil_0) === 'bigint' && validUntil_0 >= 0n && validUntil_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('registerStructHash',
                                 'argument 5',
                                 'AuthCodec.compact line 160 char 1',
                                 'Uint<0..18446744073709551616>',
                                 validUntil_0)
    }
    return _dummyContract._registerStructHash_0(manager_0,
                                                account_0,
                                                owner_0,
                                                accountSalt_0,
                                                validUntil_0);
  },
  withdrawShieldedStructHash: (...args_0) => {
    if (args_0.length !== 9) {
      throw new __compactRuntime.CompactError(`withdrawShieldedStructHash: expected 9 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const manager_0 = args_0[0];
    const account_0 = args_0[1];
    const owner_0 = args_0[2];
    const nonce_0 = args_0[3];
    const validUntil_0 = args_0[4];
    const color_0 = args_0[5];
    const amount_0 = args_0[6];
    const recipientKind_0 = args_0[7];
    const recipient_0 = args_0[8];
    if (!(manager_0.buffer instanceof ArrayBuffer && manager_0.BYTES_PER_ELEMENT === 1 && manager_0.length === 32)) {
      __compactRuntime.typeError('withdrawShieldedStructHash',
                                 'argument 1',
                                 'AuthCodec.compact line 174 char 1',
                                 'Bytes<32>',
                                 manager_0)
    }
    if (!(account_0.buffer instanceof ArrayBuffer && account_0.BYTES_PER_ELEMENT === 1 && account_0.length === 32)) {
      __compactRuntime.typeError('withdrawShieldedStructHash',
                                 'argument 2',
                                 'AuthCodec.compact line 174 char 1',
                                 'Bytes<32>',
                                 account_0)
    }
    if (!(owner_0.buffer instanceof ArrayBuffer && owner_0.BYTES_PER_ELEMENT === 1 && owner_0.length === 20)) {
      __compactRuntime.typeError('withdrawShieldedStructHash',
                                 'argument 3',
                                 'AuthCodec.compact line 174 char 1',
                                 'Bytes<20>',
                                 owner_0)
    }
    if (!(typeof(nonce_0) === 'bigint' && nonce_0 >= 0n && nonce_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('withdrawShieldedStructHash',
                                 'argument 4',
                                 'AuthCodec.compact line 174 char 1',
                                 'Uint<0..18446744073709551616>',
                                 nonce_0)
    }
    if (!(typeof(validUntil_0) === 'bigint' && validUntil_0 >= 0n && validUntil_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('withdrawShieldedStructHash',
                                 'argument 5',
                                 'AuthCodec.compact line 174 char 1',
                                 'Uint<0..18446744073709551616>',
                                 validUntil_0)
    }
    if (!(color_0.buffer instanceof ArrayBuffer && color_0.BYTES_PER_ELEMENT === 1 && color_0.length === 32)) {
      __compactRuntime.typeError('withdrawShieldedStructHash',
                                 'argument 6',
                                 'AuthCodec.compact line 174 char 1',
                                 'Bytes<32>',
                                 color_0)
    }
    if (!(typeof(amount_0) === 'bigint' && amount_0 >= 0n && amount_0 <= 340282366920938463463374607431768211455n)) {
      __compactRuntime.typeError('withdrawShieldedStructHash',
                                 'argument 7',
                                 'AuthCodec.compact line 174 char 1',
                                 'Uint<0..340282366920938463463374607431768211456>',
                                 amount_0)
    }
    if (!(typeof(recipientKind_0) === 'bigint' && recipientKind_0 >= 0n && recipientKind_0 <= 255n)) {
      __compactRuntime.typeError('withdrawShieldedStructHash',
                                 'argument 8',
                                 'AuthCodec.compact line 174 char 1',
                                 'Uint<0..256>',
                                 recipientKind_0)
    }
    if (!(recipient_0.buffer instanceof ArrayBuffer && recipient_0.BYTES_PER_ELEMENT === 1 && recipient_0.length === 32)) {
      __compactRuntime.typeError('withdrawShieldedStructHash',
                                 'argument 9',
                                 'AuthCodec.compact line 174 char 1',
                                 'Bytes<32>',
                                 recipient_0)
    }
    return _dummyContract._withdrawShieldedStructHash_0(manager_0,
                                                        account_0,
                                                        owner_0,
                                                        nonce_0,
                                                        validUntil_0,
                                                        color_0,
                                                        amount_0,
                                                        recipientKind_0,
                                                        recipient_0);
  },
  withdrawUnshieldedStructHash: (...args_0) => {
    if (args_0.length !== 9) {
      throw new __compactRuntime.CompactError(`withdrawUnshieldedStructHash: expected 9 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const manager_0 = args_0[0];
    const account_0 = args_0[1];
    const owner_0 = args_0[2];
    const nonce_0 = args_0[3];
    const validUntil_0 = args_0[4];
    const color_0 = args_0[5];
    const amount_0 = args_0[6];
    const recipientKind_0 = args_0[7];
    const recipient_0 = args_0[8];
    if (!(manager_0.buffer instanceof ArrayBuffer && manager_0.BYTES_PER_ELEMENT === 1 && manager_0.length === 32)) {
      __compactRuntime.typeError('withdrawUnshieldedStructHash',
                                 'argument 1',
                                 'AuthCodec.compact line 187 char 1',
                                 'Bytes<32>',
                                 manager_0)
    }
    if (!(account_0.buffer instanceof ArrayBuffer && account_0.BYTES_PER_ELEMENT === 1 && account_0.length === 32)) {
      __compactRuntime.typeError('withdrawUnshieldedStructHash',
                                 'argument 2',
                                 'AuthCodec.compact line 187 char 1',
                                 'Bytes<32>',
                                 account_0)
    }
    if (!(owner_0.buffer instanceof ArrayBuffer && owner_0.BYTES_PER_ELEMENT === 1 && owner_0.length === 20)) {
      __compactRuntime.typeError('withdrawUnshieldedStructHash',
                                 'argument 3',
                                 'AuthCodec.compact line 187 char 1',
                                 'Bytes<20>',
                                 owner_0)
    }
    if (!(typeof(nonce_0) === 'bigint' && nonce_0 >= 0n && nonce_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('withdrawUnshieldedStructHash',
                                 'argument 4',
                                 'AuthCodec.compact line 187 char 1',
                                 'Uint<0..18446744073709551616>',
                                 nonce_0)
    }
    if (!(typeof(validUntil_0) === 'bigint' && validUntil_0 >= 0n && validUntil_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('withdrawUnshieldedStructHash',
                                 'argument 5',
                                 'AuthCodec.compact line 187 char 1',
                                 'Uint<0..18446744073709551616>',
                                 validUntil_0)
    }
    if (!(color_0.buffer instanceof ArrayBuffer && color_0.BYTES_PER_ELEMENT === 1 && color_0.length === 32)) {
      __compactRuntime.typeError('withdrawUnshieldedStructHash',
                                 'argument 6',
                                 'AuthCodec.compact line 187 char 1',
                                 'Bytes<32>',
                                 color_0)
    }
    if (!(typeof(amount_0) === 'bigint' && amount_0 >= 0n && amount_0 <= 340282366920938463463374607431768211455n)) {
      __compactRuntime.typeError('withdrawUnshieldedStructHash',
                                 'argument 7',
                                 'AuthCodec.compact line 187 char 1',
                                 'Uint<0..340282366920938463463374607431768211456>',
                                 amount_0)
    }
    if (!(typeof(recipientKind_0) === 'bigint' && recipientKind_0 >= 0n && recipientKind_0 <= 255n)) {
      __compactRuntime.typeError('withdrawUnshieldedStructHash',
                                 'argument 8',
                                 'AuthCodec.compact line 187 char 1',
                                 'Uint<0..256>',
                                 recipientKind_0)
    }
    if (!(recipient_0.buffer instanceof ArrayBuffer && recipient_0.BYTES_PER_ELEMENT === 1 && recipient_0.length === 32)) {
      __compactRuntime.typeError('withdrawUnshieldedStructHash',
                                 'argument 9',
                                 'AuthCodec.compact line 187 char 1',
                                 'Bytes<32>',
                                 recipient_0)
    }
    return _dummyContract._withdrawUnshieldedStructHash_0(manager_0,
                                                          account_0,
                                                          owner_0,
                                                          nonce_0,
                                                          validUntil_0,
                                                          color_0,
                                                          amount_0,
                                                          recipientKind_0,
                                                          recipient_0);
  },
  transferShieldedStructHash: (...args_0) => {
    if (args_0.length !== 8) {
      throw new __compactRuntime.CompactError(`transferShieldedStructHash: expected 8 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const manager_0 = args_0[0];
    const account_0 = args_0[1];
    const owner_0 = args_0[2];
    const nonce_0 = args_0[3];
    const validUntil_0 = args_0[4];
    const toAccount_0 = args_0[5];
    const color_0 = args_0[6];
    const amount_0 = args_0[7];
    if (!(manager_0.buffer instanceof ArrayBuffer && manager_0.BYTES_PER_ELEMENT === 1 && manager_0.length === 32)) {
      __compactRuntime.typeError('transferShieldedStructHash',
                                 'argument 1',
                                 'AuthCodec.compact line 200 char 1',
                                 'Bytes<32>',
                                 manager_0)
    }
    if (!(account_0.buffer instanceof ArrayBuffer && account_0.BYTES_PER_ELEMENT === 1 && account_0.length === 32)) {
      __compactRuntime.typeError('transferShieldedStructHash',
                                 'argument 2',
                                 'AuthCodec.compact line 200 char 1',
                                 'Bytes<32>',
                                 account_0)
    }
    if (!(owner_0.buffer instanceof ArrayBuffer && owner_0.BYTES_PER_ELEMENT === 1 && owner_0.length === 20)) {
      __compactRuntime.typeError('transferShieldedStructHash',
                                 'argument 3',
                                 'AuthCodec.compact line 200 char 1',
                                 'Bytes<20>',
                                 owner_0)
    }
    if (!(typeof(nonce_0) === 'bigint' && nonce_0 >= 0n && nonce_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('transferShieldedStructHash',
                                 'argument 4',
                                 'AuthCodec.compact line 200 char 1',
                                 'Uint<0..18446744073709551616>',
                                 nonce_0)
    }
    if (!(typeof(validUntil_0) === 'bigint' && validUntil_0 >= 0n && validUntil_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('transferShieldedStructHash',
                                 'argument 5',
                                 'AuthCodec.compact line 200 char 1',
                                 'Uint<0..18446744073709551616>',
                                 validUntil_0)
    }
    if (!(toAccount_0.buffer instanceof ArrayBuffer && toAccount_0.BYTES_PER_ELEMENT === 1 && toAccount_0.length === 32)) {
      __compactRuntime.typeError('transferShieldedStructHash',
                                 'argument 6',
                                 'AuthCodec.compact line 200 char 1',
                                 'Bytes<32>',
                                 toAccount_0)
    }
    if (!(color_0.buffer instanceof ArrayBuffer && color_0.BYTES_PER_ELEMENT === 1 && color_0.length === 32)) {
      __compactRuntime.typeError('transferShieldedStructHash',
                                 'argument 7',
                                 'AuthCodec.compact line 200 char 1',
                                 'Bytes<32>',
                                 color_0)
    }
    if (!(typeof(amount_0) === 'bigint' && amount_0 >= 0n && amount_0 <= 340282366920938463463374607431768211455n)) {
      __compactRuntime.typeError('transferShieldedStructHash',
                                 'argument 8',
                                 'AuthCodec.compact line 200 char 1',
                                 'Uint<0..340282366920938463463374607431768211456>',
                                 amount_0)
    }
    return _dummyContract._transferShieldedStructHash_0(manager_0,
                                                        account_0,
                                                        owner_0,
                                                        nonce_0,
                                                        validUntil_0,
                                                        toAccount_0,
                                                        color_0,
                                                        amount_0);
  },
  transferUnshieldedStructHash: (...args_0) => {
    if (args_0.length !== 8) {
      throw new __compactRuntime.CompactError(`transferUnshieldedStructHash: expected 8 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const manager_0 = args_0[0];
    const account_0 = args_0[1];
    const owner_0 = args_0[2];
    const nonce_0 = args_0[3];
    const validUntil_0 = args_0[4];
    const toAccount_0 = args_0[5];
    const color_0 = args_0[6];
    const amount_0 = args_0[7];
    if (!(manager_0.buffer instanceof ArrayBuffer && manager_0.BYTES_PER_ELEMENT === 1 && manager_0.length === 32)) {
      __compactRuntime.typeError('transferUnshieldedStructHash',
                                 'argument 1',
                                 'AuthCodec.compact line 211 char 1',
                                 'Bytes<32>',
                                 manager_0)
    }
    if (!(account_0.buffer instanceof ArrayBuffer && account_0.BYTES_PER_ELEMENT === 1 && account_0.length === 32)) {
      __compactRuntime.typeError('transferUnshieldedStructHash',
                                 'argument 2',
                                 'AuthCodec.compact line 211 char 1',
                                 'Bytes<32>',
                                 account_0)
    }
    if (!(owner_0.buffer instanceof ArrayBuffer && owner_0.BYTES_PER_ELEMENT === 1 && owner_0.length === 20)) {
      __compactRuntime.typeError('transferUnshieldedStructHash',
                                 'argument 3',
                                 'AuthCodec.compact line 211 char 1',
                                 'Bytes<20>',
                                 owner_0)
    }
    if (!(typeof(nonce_0) === 'bigint' && nonce_0 >= 0n && nonce_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('transferUnshieldedStructHash',
                                 'argument 4',
                                 'AuthCodec.compact line 211 char 1',
                                 'Uint<0..18446744073709551616>',
                                 nonce_0)
    }
    if (!(typeof(validUntil_0) === 'bigint' && validUntil_0 >= 0n && validUntil_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('transferUnshieldedStructHash',
                                 'argument 5',
                                 'AuthCodec.compact line 211 char 1',
                                 'Uint<0..18446744073709551616>',
                                 validUntil_0)
    }
    if (!(toAccount_0.buffer instanceof ArrayBuffer && toAccount_0.BYTES_PER_ELEMENT === 1 && toAccount_0.length === 32)) {
      __compactRuntime.typeError('transferUnshieldedStructHash',
                                 'argument 6',
                                 'AuthCodec.compact line 211 char 1',
                                 'Bytes<32>',
                                 toAccount_0)
    }
    if (!(color_0.buffer instanceof ArrayBuffer && color_0.BYTES_PER_ELEMENT === 1 && color_0.length === 32)) {
      __compactRuntime.typeError('transferUnshieldedStructHash',
                                 'argument 7',
                                 'AuthCodec.compact line 211 char 1',
                                 'Bytes<32>',
                                 color_0)
    }
    if (!(typeof(amount_0) === 'bigint' && amount_0 >= 0n && amount_0 <= 340282366920938463463374607431768211455n)) {
      __compactRuntime.typeError('transferUnshieldedStructHash',
                                 'argument 8',
                                 'AuthCodec.compact line 211 char 1',
                                 'Uint<0..340282366920938463463374607431768211456>',
                                 amount_0)
    }
    return _dummyContract._transferUnshieldedStructHash_0(manager_0,
                                                          account_0,
                                                          owner_0,
                                                          nonce_0,
                                                          validUntil_0,
                                                          toAccount_0,
                                                          color_0,
                                                          amount_0);
  },
  openSwapStructHash: (...args_0) => {
    if (args_0.length !== 13) {
      throw new __compactRuntime.CompactError(`openSwapStructHash: expected 13 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const manager_0 = args_0[0];
    const account_0 = args_0[1];
    const owner_0 = args_0[2];
    const nonce_0 = args_0[3];
    const validUntil_0 = args_0[4];
    const giveColor_0 = args_0[5];
    const giveAmount_0 = args_0[6];
    const recipientKind_0 = args_0[7];
    const recipient_0 = args_0[8];
    const wantNonce_0 = args_0[9];
    const wantColor_0 = args_0[10];
    const wantAmount_0 = args_0[11];
    const creditAccount_0 = args_0[12];
    if (!(manager_0.buffer instanceof ArrayBuffer && manager_0.BYTES_PER_ELEMENT === 1 && manager_0.length === 32)) {
      __compactRuntime.typeError('openSwapStructHash',
                                 'argument 1',
                                 'AuthCodec.compact line 222 char 1',
                                 'Bytes<32>',
                                 manager_0)
    }
    if (!(account_0.buffer instanceof ArrayBuffer && account_0.BYTES_PER_ELEMENT === 1 && account_0.length === 32)) {
      __compactRuntime.typeError('openSwapStructHash',
                                 'argument 2',
                                 'AuthCodec.compact line 222 char 1',
                                 'Bytes<32>',
                                 account_0)
    }
    if (!(owner_0.buffer instanceof ArrayBuffer && owner_0.BYTES_PER_ELEMENT === 1 && owner_0.length === 20)) {
      __compactRuntime.typeError('openSwapStructHash',
                                 'argument 3',
                                 'AuthCodec.compact line 222 char 1',
                                 'Bytes<20>',
                                 owner_0)
    }
    if (!(typeof(nonce_0) === 'bigint' && nonce_0 >= 0n && nonce_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('openSwapStructHash',
                                 'argument 4',
                                 'AuthCodec.compact line 222 char 1',
                                 'Uint<0..18446744073709551616>',
                                 nonce_0)
    }
    if (!(typeof(validUntil_0) === 'bigint' && validUntil_0 >= 0n && validUntil_0 <= 18446744073709551615n)) {
      __compactRuntime.typeError('openSwapStructHash',
                                 'argument 5',
                                 'AuthCodec.compact line 222 char 1',
                                 'Uint<0..18446744073709551616>',
                                 validUntil_0)
    }
    if (!(giveColor_0.buffer instanceof ArrayBuffer && giveColor_0.BYTES_PER_ELEMENT === 1 && giveColor_0.length === 32)) {
      __compactRuntime.typeError('openSwapStructHash',
                                 'argument 6',
                                 'AuthCodec.compact line 222 char 1',
                                 'Bytes<32>',
                                 giveColor_0)
    }
    if (!(typeof(giveAmount_0) === 'bigint' && giveAmount_0 >= 0n && giveAmount_0 <= 340282366920938463463374607431768211455n)) {
      __compactRuntime.typeError('openSwapStructHash',
                                 'argument 7',
                                 'AuthCodec.compact line 222 char 1',
                                 'Uint<0..340282366920938463463374607431768211456>',
                                 giveAmount_0)
    }
    if (!(typeof(recipientKind_0) === 'bigint' && recipientKind_0 >= 0n && recipientKind_0 <= 255n)) {
      __compactRuntime.typeError('openSwapStructHash',
                                 'argument 8',
                                 'AuthCodec.compact line 222 char 1',
                                 'Uint<0..256>',
                                 recipientKind_0)
    }
    if (!(recipient_0.buffer instanceof ArrayBuffer && recipient_0.BYTES_PER_ELEMENT === 1 && recipient_0.length === 32)) {
      __compactRuntime.typeError('openSwapStructHash',
                                 'argument 9',
                                 'AuthCodec.compact line 222 char 1',
                                 'Bytes<32>',
                                 recipient_0)
    }
    if (!(wantNonce_0.buffer instanceof ArrayBuffer && wantNonce_0.BYTES_PER_ELEMENT === 1 && wantNonce_0.length === 32)) {
      __compactRuntime.typeError('openSwapStructHash',
                                 'argument 10',
                                 'AuthCodec.compact line 222 char 1',
                                 'Bytes<32>',
                                 wantNonce_0)
    }
    if (!(wantColor_0.buffer instanceof ArrayBuffer && wantColor_0.BYTES_PER_ELEMENT === 1 && wantColor_0.length === 32)) {
      __compactRuntime.typeError('openSwapStructHash',
                                 'argument 11',
                                 'AuthCodec.compact line 222 char 1',
                                 'Bytes<32>',
                                 wantColor_0)
    }
    if (!(typeof(wantAmount_0) === 'bigint' && wantAmount_0 >= 0n && wantAmount_0 <= 340282366920938463463374607431768211455n)) {
      __compactRuntime.typeError('openSwapStructHash',
                                 'argument 12',
                                 'AuthCodec.compact line 222 char 1',
                                 'Uint<0..340282366920938463463374607431768211456>',
                                 wantAmount_0)
    }
    if (!(creditAccount_0.buffer instanceof ArrayBuffer && creditAccount_0.BYTES_PER_ELEMENT === 1 && creditAccount_0.length === 32)) {
      __compactRuntime.typeError('openSwapStructHash',
                                 'argument 13',
                                 'AuthCodec.compact line 222 char 1',
                                 'Bytes<32>',
                                 creditAccount_0)
    }
    return _dummyContract._openSwapStructHash_0(manager_0,
                                                account_0,
                                                owner_0,
                                                nonce_0,
                                                validUntil_0,
                                                giveColor_0,
                                                giveAmount_0,
                                                recipientKind_0,
                                                recipient_0,
                                                wantNonce_0,
                                                wantColor_0,
                                                wantAmount_0,
                                                creditAccount_0);
  },
  eip712Digest: (...args_0) => {
    if (args_0.length !== 2) {
      throw new __compactRuntime.CompactError(`eip712Digest: expected 2 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const domain_0 = args_0[0];
    const structHash_0 = args_0[1];
    if (!(domain_0.buffer instanceof ArrayBuffer && domain_0.BYTES_PER_ELEMENT === 1 && domain_0.length === 32)) {
      __compactRuntime.typeError('eip712Digest',
                                 'argument 1',
                                 'AuthCodec.compact line 237 char 1',
                                 'Bytes<32>',
                                 domain_0)
    }
    if (!(structHash_0.buffer instanceof ArrayBuffer && structHash_0.BYTES_PER_ELEMENT === 1 && structHash_0.length === 32)) {
      __compactRuntime.typeError('eip712Digest',
                                 'argument 2',
                                 'AuthCodec.compact line 237 char 1',
                                 'Bytes<32>',
                                 structHash_0)
    }
    return _dummyContract._eip712Digest_0(domain_0, structHash_0);
  },
  semanticCommitment: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`semanticCommitment: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const preimage_0 = args_0[0];
    if (!(preimage_0.buffer instanceof ArrayBuffer && preimage_0.BYTES_PER_ELEMENT === 1 && preimage_0.length === 1024)) {
      __compactRuntime.typeError('semanticCommitment',
                                 'argument 1',
                                 'AuthCodec.compact line 246 char 1',
                                 'Bytes<1024>',
                                 preimage_0)
    }
    return _dummyContract._semanticCommitment_0(preimage_0);
  },
  signerAddress: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`signerAddress: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const pk_0 = args_0[0];
    return _dummyContract._signerAddress_0(pk_0);
  },
  verifySignature: (...args_0) => {
    if (args_0.length !== 3) {
      throw new __compactRuntime.CompactError(`verifySignature: expected 3 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const digest_0 = args_0[0];
    const signature_0 = args_0[1];
    const pk_0 = args_0[2];
    if (!(digest_0.buffer instanceof ArrayBuffer && digest_0.BYTES_PER_ELEMENT === 1 && digest_0.length === 32)) {
      __compactRuntime.typeError('verifySignature',
                                 'argument 1',
                                 'AuthCodec.compact line 254 char 1',
                                 'Bytes<32>',
                                 digest_0)
    }
    if (!(typeof(signature_0) === 'object' && typeof(signature_0.r) === 'bigint' && signature_0.r >= 0 && signature_0.r <= __compactRuntime.MAX_SECP256K1_SCALAR && typeof(signature_0.s) === 'bigint' && signature_0.s >= 0 && signature_0.s <= __compactRuntime.MAX_SECP256K1_SCALAR)) {
      __compactRuntime.typeError('verifySignature',
                                 'argument 2',
                                 'AuthCodec.compact line 254 char 1',
                                 'struct Secp256k1EcdsaSignature<r: Secp256k1Scalar, s: Secp256k1Scalar>',
                                 signature_0)
    }
    return _dummyContract._verifySignature_0(digest_0, signature_0, pk_0);
  },
  pointXBigEndian: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`pointXBigEndian: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const pk_0 = args_0[0];
    return _dummyContract._pointXBigEndian_0(pk_0);
  },
  pointYBigEndian: (...args_0) => {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`pointYBigEndian: expected 1 argument (as invoked from Typescript), received ${args_0.length}`);
    }
    const pk_0 = args_0[0];
    return _dummyContract._pointYBigEndian_0(pk_0);
  }
};
export const contractReferenceLocations =
  { tag: 'publicLedgerArray', indices: { } };
export const expectedVk = {};

//# sourceMappingURL=index.js.map
