/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumber,
  BigNumberish,
  BytesLike,
  CallOverrides,
  ContractTransaction,
  Overrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import type {
  FunctionFragment,
  Result,
  EventFragment,
} from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type {
  TypedEventFilter,
  TypedEvent,
  TypedListener,
  OnEvent,
  PromiseOrValue,
} from "./semaphoreCommon";

export type EdgeStruct = {
  chainID: PromiseOrValue<BigNumberish>;
  root: PromiseOrValue<BytesLike>;
  latestLeafIndex: PromiseOrValue<BigNumberish>;
  srcResourceID: PromiseOrValue<BytesLike>;
};

export type EdgeStructOutput = [BigNumber, string, BigNumber, string] & {
  chainID: BigNumber;
  root: string;
  latestLeafIndex: BigNumber;
  srcResourceID: string;
};

export declare namespace ISemaphore {
  export type VerifierStruct = {
    contractAddress: PromiseOrValue<string>;
    merkleTreeDepth: PromiseOrValue<BigNumberish>;
  };

  export type VerifierStructOutput = [string, number] & {
    contractAddress: string;
    merkleTreeDepth: number;
  };
}

export interface SemaphoreInterface extends utils.Interface {
  functions: {
    "EVM_CHAIN_ID_TYPE()": FunctionFragment;
    "addMember(uint256,uint256)": FunctionFragment;
    "createGroup(uint256,uint8,address,uint8)": FunctionFragment;
    "decodeRoots(bytes)": FunctionFragment;
    "getChainId()": FunctionFragment;
    "getChainIdType()": FunctionFragment;
    "getDepth(uint256)": FunctionFragment;
    "getLatestNeighborEdges(uint256)": FunctionFragment;
    "getMaxEdges(uint256)": FunctionFragment;
    "getNumberOfLeaves(uint256)": FunctionFragment;
    "getRoot(uint256)": FunctionFragment;
    "groupAdmins(uint256)": FunctionFragment;
    "groupMaxEdges(uint256)": FunctionFragment;
    "removeMember(uint256,uint256,uint256[],uint8[])": FunctionFragment;
    "updateEdge(uint256,bytes32,uint32,bytes32)": FunctionFragment;
    "updateGroupAdmin(uint256,address)": FunctionFragment;
    "verifiers(uint8)": FunctionFragment;
    "verifyProof(uint256,bytes32,uint256,uint256,bytes,uint256[8])": FunctionFragment;
    "verifyRoots(uint256,bytes)": FunctionFragment;
  };

  getFunction(
    nameOrSignatureOrTopic:
      | "EVM_CHAIN_ID_TYPE"
      | "addMember"
      | "createGroup"
      | "decodeRoots"
      | "getChainId"
      | "getChainIdType"
      | "getDepth"
      | "getLatestNeighborEdges"
      | "getMaxEdges"
      | "getNumberOfLeaves"
      | "getRoot"
      | "groupAdmins"
      | "groupMaxEdges"
      | "removeMember"
      | "updateEdge"
      | "updateGroupAdmin"
      | "verifiers"
      | "verifyProof"
      | "verifyRoots"
  ): FunctionFragment;

  encodeFunctionData(
    functionFragment: "EVM_CHAIN_ID_TYPE",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "addMember",
    values: [PromiseOrValue<BigNumberish>, PromiseOrValue<BigNumberish>]
  ): string;
  encodeFunctionData(
    functionFragment: "createGroup",
    values: [
      PromiseOrValue<BigNumberish>,
      PromiseOrValue<BigNumberish>,
      PromiseOrValue<string>,
      PromiseOrValue<BigNumberish>
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "decodeRoots",
    values: [PromiseOrValue<BytesLike>]
  ): string;
  encodeFunctionData(
    functionFragment: "getChainId",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getChainIdType",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "getDepth",
    values: [PromiseOrValue<BigNumberish>]
  ): string;
  encodeFunctionData(
    functionFragment: "getLatestNeighborEdges",
    values: [PromiseOrValue<BigNumberish>]
  ): string;
  encodeFunctionData(
    functionFragment: "getMaxEdges",
    values: [PromiseOrValue<BigNumberish>]
  ): string;
  encodeFunctionData(
    functionFragment: "getNumberOfLeaves",
    values: [PromiseOrValue<BigNumberish>]
  ): string;
  encodeFunctionData(
    functionFragment: "getRoot",
    values: [PromiseOrValue<BigNumberish>]
  ): string;
  encodeFunctionData(
    functionFragment: "groupAdmins",
    values: [PromiseOrValue<BigNumberish>]
  ): string;
  encodeFunctionData(
    functionFragment: "groupMaxEdges",
    values: [PromiseOrValue<BigNumberish>]
  ): string;
  encodeFunctionData(
    functionFragment: "removeMember",
    values: [
      PromiseOrValue<BigNumberish>,
      PromiseOrValue<BigNumberish>,
      PromiseOrValue<BigNumberish>[],
      PromiseOrValue<BigNumberish>[]
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "updateEdge",
    values: [
      PromiseOrValue<BigNumberish>,
      PromiseOrValue<BytesLike>,
      PromiseOrValue<BigNumberish>,
      PromiseOrValue<BytesLike>
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "updateGroupAdmin",
    values: [PromiseOrValue<BigNumberish>, PromiseOrValue<string>]
  ): string;
  encodeFunctionData(
    functionFragment: "verifiers",
    values: [PromiseOrValue<BigNumberish>]
  ): string;
  encodeFunctionData(
    functionFragment: "verifyProof",
    values: [
      PromiseOrValue<BigNumberish>,
      PromiseOrValue<BytesLike>,
      PromiseOrValue<BigNumberish>,
      PromiseOrValue<BigNumberish>,
      PromiseOrValue<BytesLike>,
      PromiseOrValue<BigNumberish>[]
    ]
  ): string;
  encodeFunctionData(
    functionFragment: "verifyRoots",
    values: [PromiseOrValue<BigNumberish>, PromiseOrValue<BytesLike>]
  ): string;

  decodeFunctionResult(
    functionFragment: "EVM_CHAIN_ID_TYPE",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "addMember", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "createGroup",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "decodeRoots",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "getChainId", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "getChainIdType",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "getDepth", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "getLatestNeighborEdges",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getMaxEdges",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "getNumberOfLeaves",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "getRoot", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "groupAdmins",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "groupMaxEdges",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "removeMember",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "updateEdge", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "updateGroupAdmin",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "verifiers", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "verifyProof",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "verifyRoots",
    data: BytesLike
  ): Result;

  events: {
    "GroupAdminUpdated(uint256,address,address)": EventFragment;
    "GroupCreated(uint256,uint8)": EventFragment;
    "MemberAdded(uint256,uint256,uint256)": EventFragment;
    "MemberRemoved(uint256,uint256,uint256)": EventFragment;
    "NullifierHashAdded(uint256)": EventFragment;
    "ProofVerified(uint256,bytes32)": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "GroupAdminUpdated"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "GroupCreated"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "MemberAdded"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "MemberRemoved"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "NullifierHashAdded"): EventFragment;
  getEvent(nameOrSignatureOrTopic: "ProofVerified"): EventFragment;
}

export interface GroupAdminUpdatedEventObject {
  groupId: BigNumber;
  oldAdmin: string;
  newAdmin: string;
}
export type GroupAdminUpdatedEvent = TypedEvent<
  [BigNumber, string, string],
  GroupAdminUpdatedEventObject
>;

export type GroupAdminUpdatedEventFilter =
  TypedEventFilter<GroupAdminUpdatedEvent>;

export interface GroupCreatedEventObject {
  groupId: BigNumber;
  depth: number;
}
export type GroupCreatedEvent = TypedEvent<
  [BigNumber, number],
  GroupCreatedEventObject
>;

export type GroupCreatedEventFilter = TypedEventFilter<GroupCreatedEvent>;

export interface MemberAddedEventObject {
  groupId: BigNumber;
  identityCommitment: BigNumber;
  root: BigNumber;
}
export type MemberAddedEvent = TypedEvent<
  [BigNumber, BigNumber, BigNumber],
  MemberAddedEventObject
>;

export type MemberAddedEventFilter = TypedEventFilter<MemberAddedEvent>;

export interface MemberRemovedEventObject {
  groupId: BigNumber;
  identityCommitment: BigNumber;
  root: BigNumber;
}
export type MemberRemovedEvent = TypedEvent<
  [BigNumber, BigNumber, BigNumber],
  MemberRemovedEventObject
>;

export type MemberRemovedEventFilter = TypedEventFilter<MemberRemovedEvent>;

export interface NullifierHashAddedEventObject {
  nullifierHash: BigNumber;
}
export type NullifierHashAddedEvent = TypedEvent<
  [BigNumber],
  NullifierHashAddedEventObject
>;

export type NullifierHashAddedEventFilter =
  TypedEventFilter<NullifierHashAddedEvent>;

export interface ProofVerifiedEventObject {
  groupId: BigNumber;
  signal: string;
}
export type ProofVerifiedEvent = TypedEvent<
  [BigNumber, string],
  ProofVerifiedEventObject
>;

export type ProofVerifiedEventFilter = TypedEventFilter<ProofVerifiedEvent>;

export interface Semaphore extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: SemaphoreInterface;

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>;

  listeners<TEvent extends TypedEvent>(
    eventFilter?: TypedEventFilter<TEvent>
  ): Array<TypedListener<TEvent>>;
  listeners(eventName?: string): Array<Listener>;
  removeAllListeners<TEvent extends TypedEvent>(
    eventFilter: TypedEventFilter<TEvent>
  ): this;
  removeAllListeners(eventName?: string): this;
  off: OnEvent<this>;
  on: OnEvent<this>;
  once: OnEvent<this>;
  removeListener: OnEvent<this>;

  functions: {
    EVM_CHAIN_ID_TYPE(overrides?: CallOverrides): Promise<[string]>;

    addMember(
      groupId: PromiseOrValue<BigNumberish>,
      identityCommitment: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    createGroup(
      groupId: PromiseOrValue<BigNumberish>,
      depth: PromiseOrValue<BigNumberish>,
      admin: PromiseOrValue<string>,
      maxEdges: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    decodeRoots(
      roots: PromiseOrValue<BytesLike>,
      overrides?: CallOverrides
    ): Promise<[string[]] & { roots_decoded: string[] }>;

    getChainId(overrides?: CallOverrides): Promise<[BigNumber]>;

    getChainIdType(overrides?: CallOverrides): Promise<[number]>;

    getDepth(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<[number]>;

    getLatestNeighborEdges(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<[EdgeStructOutput[]]>;

    getMaxEdges(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<[number]>;

    getNumberOfLeaves(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<[BigNumber]>;

    getRoot(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<[BigNumber]>;

    groupAdmins(
      arg0: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<[string]>;

    groupMaxEdges(
      arg0: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<[number]>;

    removeMember(
      groupId: PromiseOrValue<BigNumberish>,
      identityCommitment: PromiseOrValue<BigNumberish>,
      proofSiblings: PromiseOrValue<BigNumberish>[],
      proofPathIndices: PromiseOrValue<BigNumberish>[],
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    updateEdge(
      groupId: PromiseOrValue<BigNumberish>,
      root: PromiseOrValue<BytesLike>,
      leafIndex: PromiseOrValue<BigNumberish>,
      srcResourceID: PromiseOrValue<BytesLike>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    updateGroupAdmin(
      groupId: PromiseOrValue<BigNumberish>,
      newAdmin: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    verifiers(
      arg0: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<[string]>;

    verifyProof(
      groupId: PromiseOrValue<BigNumberish>,
      signal: PromiseOrValue<BytesLike>,
      nullifierHash: PromiseOrValue<BigNumberish>,
      externalNullifier: PromiseOrValue<BigNumberish>,
      roots: PromiseOrValue<BytesLike>,
      proof: PromiseOrValue<BigNumberish>[],
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<ContractTransaction>;

    verifyRoots(
      groupId: PromiseOrValue<BigNumberish>,
      roots: PromiseOrValue<BytesLike>,
      overrides?: CallOverrides
    ): Promise<[boolean]>;
  };

  EVM_CHAIN_ID_TYPE(overrides?: CallOverrides): Promise<string>;

  addMember(
    groupId: PromiseOrValue<BigNumberish>,
    identityCommitment: PromiseOrValue<BigNumberish>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  createGroup(
    groupId: PromiseOrValue<BigNumberish>,
    depth: PromiseOrValue<BigNumberish>,
    admin: PromiseOrValue<string>,
    maxEdges: PromiseOrValue<BigNumberish>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  decodeRoots(
    roots: PromiseOrValue<BytesLike>,
    overrides?: CallOverrides
  ): Promise<string[]>;

  getChainId(overrides?: CallOverrides): Promise<BigNumber>;

  getChainIdType(overrides?: CallOverrides): Promise<number>;

  getDepth(
    groupId: PromiseOrValue<BigNumberish>,
    overrides?: CallOverrides
  ): Promise<number>;

  getLatestNeighborEdges(
    groupId: PromiseOrValue<BigNumberish>,
    overrides?: CallOverrides
  ): Promise<EdgeStructOutput[]>;

  getMaxEdges(
    groupId: PromiseOrValue<BigNumberish>,
    overrides?: CallOverrides
  ): Promise<number>;

  getNumberOfLeaves(
    groupId: PromiseOrValue<BigNumberish>,
    overrides?: CallOverrides
  ): Promise<BigNumber>;

  getRoot(
    groupId: PromiseOrValue<BigNumberish>,
    overrides?: CallOverrides
  ): Promise<BigNumber>;

  groupAdmins(
    arg0: PromiseOrValue<BigNumberish>,
    overrides?: CallOverrides
  ): Promise<string>;

  groupMaxEdges(
    arg0: PromiseOrValue<BigNumberish>,
    overrides?: CallOverrides
  ): Promise<number>;

  removeMember(
    groupId: PromiseOrValue<BigNumberish>,
    identityCommitment: PromiseOrValue<BigNumberish>,
    proofSiblings: PromiseOrValue<BigNumberish>[],
    proofPathIndices: PromiseOrValue<BigNumberish>[],
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  updateEdge(
    groupId: PromiseOrValue<BigNumberish>,
    root: PromiseOrValue<BytesLike>,
    leafIndex: PromiseOrValue<BigNumberish>,
    srcResourceID: PromiseOrValue<BytesLike>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  updateGroupAdmin(
    groupId: PromiseOrValue<BigNumberish>,
    newAdmin: PromiseOrValue<string>,
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  verifiers(
    arg0: PromiseOrValue<BigNumberish>,
    overrides?: CallOverrides
  ): Promise<string>;

  verifyProof(
    groupId: PromiseOrValue<BigNumberish>,
    signal: PromiseOrValue<BytesLike>,
    nullifierHash: PromiseOrValue<BigNumberish>,
    externalNullifier: PromiseOrValue<BigNumberish>,
    roots: PromiseOrValue<BytesLike>,
    proof: PromiseOrValue<BigNumberish>[],
    overrides?: Overrides & { from?: PromiseOrValue<string> }
  ): Promise<ContractTransaction>;

  verifyRoots(
    groupId: PromiseOrValue<BigNumberish>,
    roots: PromiseOrValue<BytesLike>,
    overrides?: CallOverrides
  ): Promise<boolean>;

  callStatic: {
    EVM_CHAIN_ID_TYPE(overrides?: CallOverrides): Promise<string>;

    addMember(
      groupId: PromiseOrValue<BigNumberish>,
      identityCommitment: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<void>;

    createGroup(
      groupId: PromiseOrValue<BigNumberish>,
      depth: PromiseOrValue<BigNumberish>,
      admin: PromiseOrValue<string>,
      maxEdges: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<void>;

    decodeRoots(
      roots: PromiseOrValue<BytesLike>,
      overrides?: CallOverrides
    ): Promise<string[]>;

    getChainId(overrides?: CallOverrides): Promise<BigNumber>;

    getChainIdType(overrides?: CallOverrides): Promise<number>;

    getDepth(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<number>;

    getLatestNeighborEdges(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<EdgeStructOutput[]>;

    getMaxEdges(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<number>;

    getNumberOfLeaves(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getRoot(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    groupAdmins(
      arg0: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<string>;

    groupMaxEdges(
      arg0: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<number>;

    removeMember(
      groupId: PromiseOrValue<BigNumberish>,
      identityCommitment: PromiseOrValue<BigNumberish>,
      proofSiblings: PromiseOrValue<BigNumberish>[],
      proofPathIndices: PromiseOrValue<BigNumberish>[],
      overrides?: CallOverrides
    ): Promise<void>;

    updateEdge(
      groupId: PromiseOrValue<BigNumberish>,
      root: PromiseOrValue<BytesLike>,
      leafIndex: PromiseOrValue<BigNumberish>,
      srcResourceID: PromiseOrValue<BytesLike>,
      overrides?: CallOverrides
    ): Promise<void>;

    updateGroupAdmin(
      groupId: PromiseOrValue<BigNumberish>,
      newAdmin: PromiseOrValue<string>,
      overrides?: CallOverrides
    ): Promise<void>;

    verifiers(
      arg0: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<string>;

    verifyProof(
      groupId: PromiseOrValue<BigNumberish>,
      signal: PromiseOrValue<BytesLike>,
      nullifierHash: PromiseOrValue<BigNumberish>,
      externalNullifier: PromiseOrValue<BigNumberish>,
      roots: PromiseOrValue<BytesLike>,
      proof: PromiseOrValue<BigNumberish>[],
      overrides?: CallOverrides
    ): Promise<void>;

    verifyRoots(
      groupId: PromiseOrValue<BigNumberish>,
      roots: PromiseOrValue<BytesLike>,
      overrides?: CallOverrides
    ): Promise<boolean>;
  };

  filters: {
    "GroupAdminUpdated(uint256,address,address)"(
      groupId?: PromiseOrValue<BigNumberish> | null,
      oldAdmin?: PromiseOrValue<string> | null,
      newAdmin?: PromiseOrValue<string> | null
    ): GroupAdminUpdatedEventFilter;
    GroupAdminUpdated(
      groupId?: PromiseOrValue<BigNumberish> | null,
      oldAdmin?: PromiseOrValue<string> | null,
      newAdmin?: PromiseOrValue<string> | null
    ): GroupAdminUpdatedEventFilter;

    "GroupCreated(uint256,uint8)"(
      groupId?: PromiseOrValue<BigNumberish> | null,
      depth?: null
    ): GroupCreatedEventFilter;
    GroupCreated(
      groupId?: PromiseOrValue<BigNumberish> | null,
      depth?: null
    ): GroupCreatedEventFilter;

    "MemberAdded(uint256,uint256,uint256)"(
      groupId?: PromiseOrValue<BigNumberish> | null,
      identityCommitment?: null,
      root?: null
    ): MemberAddedEventFilter;
    MemberAdded(
      groupId?: PromiseOrValue<BigNumberish> | null,
      identityCommitment?: null,
      root?: null
    ): MemberAddedEventFilter;

    "MemberRemoved(uint256,uint256,uint256)"(
      groupId?: PromiseOrValue<BigNumberish> | null,
      identityCommitment?: null,
      root?: null
    ): MemberRemovedEventFilter;
    MemberRemoved(
      groupId?: PromiseOrValue<BigNumberish> | null,
      identityCommitment?: null,
      root?: null
    ): MemberRemovedEventFilter;

    "NullifierHashAdded(uint256)"(
      nullifierHash?: null
    ): NullifierHashAddedEventFilter;
    NullifierHashAdded(nullifierHash?: null): NullifierHashAddedEventFilter;

    "ProofVerified(uint256,bytes32)"(
      groupId?: PromiseOrValue<BigNumberish> | null,
      signal?: null
    ): ProofVerifiedEventFilter;
    ProofVerified(
      groupId?: PromiseOrValue<BigNumberish> | null,
      signal?: null
    ): ProofVerifiedEventFilter;
  };

  estimateGas: {
    EVM_CHAIN_ID_TYPE(overrides?: CallOverrides): Promise<BigNumber>;

    addMember(
      groupId: PromiseOrValue<BigNumberish>,
      identityCommitment: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    createGroup(
      groupId: PromiseOrValue<BigNumberish>,
      depth: PromiseOrValue<BigNumberish>,
      admin: PromiseOrValue<string>,
      maxEdges: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    decodeRoots(
      roots: PromiseOrValue<BytesLike>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getChainId(overrides?: CallOverrides): Promise<BigNumber>;

    getChainIdType(overrides?: CallOverrides): Promise<BigNumber>;

    getDepth(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getLatestNeighborEdges(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getMaxEdges(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getNumberOfLeaves(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    getRoot(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    groupAdmins(
      arg0: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    groupMaxEdges(
      arg0: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    removeMember(
      groupId: PromiseOrValue<BigNumberish>,
      identityCommitment: PromiseOrValue<BigNumberish>,
      proofSiblings: PromiseOrValue<BigNumberish>[],
      proofPathIndices: PromiseOrValue<BigNumberish>[],
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    updateEdge(
      groupId: PromiseOrValue<BigNumberish>,
      root: PromiseOrValue<BytesLike>,
      leafIndex: PromiseOrValue<BigNumberish>,
      srcResourceID: PromiseOrValue<BytesLike>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    updateGroupAdmin(
      groupId: PromiseOrValue<BigNumberish>,
      newAdmin: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    verifiers(
      arg0: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;

    verifyProof(
      groupId: PromiseOrValue<BigNumberish>,
      signal: PromiseOrValue<BytesLike>,
      nullifierHash: PromiseOrValue<BigNumberish>,
      externalNullifier: PromiseOrValue<BigNumberish>,
      roots: PromiseOrValue<BytesLike>,
      proof: PromiseOrValue<BigNumberish>[],
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<BigNumber>;

    verifyRoots(
      groupId: PromiseOrValue<BigNumberish>,
      roots: PromiseOrValue<BytesLike>,
      overrides?: CallOverrides
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    EVM_CHAIN_ID_TYPE(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    addMember(
      groupId: PromiseOrValue<BigNumberish>,
      identityCommitment: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    createGroup(
      groupId: PromiseOrValue<BigNumberish>,
      depth: PromiseOrValue<BigNumberish>,
      admin: PromiseOrValue<string>,
      maxEdges: PromiseOrValue<BigNumberish>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    decodeRoots(
      roots: PromiseOrValue<BytesLike>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getChainId(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    getChainIdType(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    getDepth(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getLatestNeighborEdges(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getMaxEdges(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getNumberOfLeaves(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    getRoot(
      groupId: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    groupAdmins(
      arg0: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    groupMaxEdges(
      arg0: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    removeMember(
      groupId: PromiseOrValue<BigNumberish>,
      identityCommitment: PromiseOrValue<BigNumberish>,
      proofSiblings: PromiseOrValue<BigNumberish>[],
      proofPathIndices: PromiseOrValue<BigNumberish>[],
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    updateEdge(
      groupId: PromiseOrValue<BigNumberish>,
      root: PromiseOrValue<BytesLike>,
      leafIndex: PromiseOrValue<BigNumberish>,
      srcResourceID: PromiseOrValue<BytesLike>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    updateGroupAdmin(
      groupId: PromiseOrValue<BigNumberish>,
      newAdmin: PromiseOrValue<string>,
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    verifiers(
      arg0: PromiseOrValue<BigNumberish>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;

    verifyProof(
      groupId: PromiseOrValue<BigNumberish>,
      signal: PromiseOrValue<BytesLike>,
      nullifierHash: PromiseOrValue<BigNumberish>,
      externalNullifier: PromiseOrValue<BigNumberish>,
      roots: PromiseOrValue<BytesLike>,
      proof: PromiseOrValue<BigNumberish>[],
      overrides?: Overrides & { from?: PromiseOrValue<string> }
    ): Promise<PopulatedTransaction>;

    verifyRoots(
      groupId: PromiseOrValue<BigNumberish>,
      roots: PromiseOrValue<BytesLike>,
      overrides?: CallOverrides
    ): Promise<PopulatedTransaction>;
  };
}