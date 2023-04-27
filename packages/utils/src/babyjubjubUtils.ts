import createBlakeHash from 'blake-hash';
const { poseidon, babyjub } = require('circomlibjs');
const { Scalar } = require('ffjavascript');

export function pruneBuffer(buff) {
  buff[0] = buff[0] & 0xf8;
  buff[31] = buff[31] & 0x7f;
  buff[31] = buff[31] | 0x40;
  return buff;
}

export function raw2prv(raw) {
  const sBuff = pruneBuffer(createBlakeHash('blake512').update(Buffer.from(raw)).digest());
  let s = Scalar.fromRprLE(sBuff, 0, 32);
  return babyjub.F.e(Scalar.shr(s, 3));
}

export function prv2pub(prv) {
  const A = babyjub.mulPointEscalar(babyjub.Base8, prv.toString());
  return A;
}
