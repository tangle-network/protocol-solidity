const Poseidon = require('./Poseidon')
const snarkjs = require('snarkjs')

const hasher = new Poseidon()
const bigInt = snarkjs.bigInt

const toHex = (number, length = 32) =>
  '0x' +
  (number instanceof Buffer ? number.toString('hex') : bigInt(number).toString(16)).padStart(length * 2, '0')

function zeros(
  levels,
  defaultZero = '21663839004416932945382355908790599225266501822907911457504978515578255421292',
) {
  const zeros = []

  let currentZero = defaultZero
  for (let i = 0; i < levels; i++) {
    zeros.push(toHex(currentZero))
    currentZero = hasher.hash(levels, currentZero, currentZero)
  }

  return zeros
}

function p256(n) {
  let nstr = BigInt(n).toString(16);
  while (nstr.length < 64) nstr = "0" +nstr;
  nstr = `"0x${nstr}"`;

  return nstr;
}

async function groth16ExportSolidityCallData(proof, pub) {
  let inputs = "";
  for (let i = 0; i < pub.length; i++) {
    if (inputs != "") inputs = inputs + ",";
    inputs = inputs + p256(pub[i]);
  }

  let S;
  S=`[${p256(proof.pi_a[0])}, ${p256(proof.pi_a[1])}],` +
    `[[${p256(proof.pi_b[0][1])}, ${p256(proof.pi_b[0][0])}],[${p256(proof.pi_b[1][1])}, ${p256(proof.pi_b[1][0])}]],` +
    `[${p256(proof.pi_c[0])}, ${p256(proof.pi_c[1])}],` +
    `[${inputs}]`;

  return S;
}

async function generateWithdrawProofCallData(proof, pub) {

  const result = await groth16ExportSolidityCallData(proof, pub);
  const fullProof = JSON.parse("[" + result + "]");
  const pi_a = fullProof[0];
  const pi_b = fullProof[1];
  const pi_c = fullProof[2];

  let proofEncoded = [
    pi_a[0],
    pi_a[1],
    pi_b[0][0],
    pi_b[0][1],
    pi_b[1][0],
    pi_b[1][1],
    pi_c[0],
    pi_c[1],
  ]
  .map(elt => elt.substr(2))
  .join('');

  return proofEncoded;
}

module.exports = {
  toHex,
  zeros,
};
