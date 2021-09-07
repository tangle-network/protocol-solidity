const PoseidonHasher = require('../../lib/Poseidon');

export type Deposit = {
  nullifier: bigint;
  secret: bigint;
  chainID: number;
  nullifierHash: bigint;
  commitment: bigint;
}

export function createDeposit(chainID: number, nullifier: bigint, secret: bigint) {
  const poseidonHasher = new PoseidonHasher();

  let deposit: Deposit = {
    nullifier,
    secret,
    commitment: poseidonHasher.hash3([chainID, nullifier, secret]),
    nullifierHash: poseidonHasher.hash(null, nullifier, nullifier),
    chainID
  };
  return deposit;
}
