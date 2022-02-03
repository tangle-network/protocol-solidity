const ethers = require('ethers');
const EC = require('elliptic');
const ec = new EC.ec('secp256k1');
const BN = require('bn.js');

const wallet = ethers.Wallet.createRandom();
const key = ec.keyFromPrivate(wallet.privateKey, 'hex');
const pubkey = key.getPublic().encode('hex').slice(2);
const publicKey = '0x' + pubkey;

let pubkeyAddress = ethers.utils.getAddress('0x' + ethers.utils.keccak256(publicKey).slice(-40));
let nextGovernorAddress = pubkeyAddress;

const nonceString = ethers.utils.hexZeroPad(ethers.utils.hexlify(2), 4);
const dummy = ethers.Wallet.createRandom();
const dummyPubkey = ec.keyFromPrivate(dummy.privateKey, 'hex').getPublic().encode('hex').slice(2);

let msg = ethers.utils.arrayify(ethers.utils.keccak256(nonceString + dummyPubkey));
let signature = key.sign(msg);
let expandedSig = { r: '0x' + signature.r.toString('hex'), s: '0x' + signature.s.toString('hex'), v: signature.recoveryParam + 27 }
let sig;

try {
  sig = ethers.utils.joinSignature(expandedSig)
} catch (e) {
  expandedSig.s = '0x' + (new BN(ec.curve.n).sub(signature.s)).toString('hex');
  expandedSig.v = (expandedSig.v === 27) ? 28 : 27;
  sig = ethers.utils.joinSignature(expandedSig)
}

const recoveredPubKey = ethers.utils.recoverPublicKey(msg, sig)
const recoveredAddress = ethers.utils.recoverAddress(msg, sig)
console.log({
  recovered: {
    pubkey: recoveredPubKey,
    pubkeyAddress: recoveredAddress,
  },
  actual: {
    pubkey: publicKey,
    pubkeyAddress: pubkeyAddress,
  }
});

console.log(`let sig = '${sig}'`);
console.log(`let data = '${nonceString + dummyPubkey}'`);
console.log(`let address = '${wallet.address}'`);
