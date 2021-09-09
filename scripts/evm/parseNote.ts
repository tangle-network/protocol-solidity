// This script takes in a note string and generates a deposit object
const { bigInt } = require('snarkjs');
import { Deposit, createDeposit } from './createDeposit';
const utils = require("ffjavascript").utils;

const {
  leBuff2int,
  unstringifyBigInts
} = utils;

export function parseNote(noteString: string): Deposit | null {
  const noteRegex = /webb-(?<chainId>\d+)-0x(?<secret>[0-9a-fA-F]{62})-0x(?<nullifier>[0-9a-fA-F]{62})/g
  const match = noteRegex.exec(noteString);

  if (match && match.groups ) {
    const chainID = Number(match.groups.chainId);
    const secretBuf = Buffer.from(match.groups.secret, 'hex');
    const nullifierBuf = Buffer.from(match.groups.nullifier, 'hex');
    const nullifier = leBuff2int(secretBuf);
    const secret = leBuff2int(nullifierBuf);
    console.log(secret);
    const deposit = createDeposit(chainID, nullifier, secret);

    return deposit;
  }
  return null;
}

