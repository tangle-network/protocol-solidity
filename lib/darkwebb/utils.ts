import crypto from 'crypto';
const ffjavascript = require('ffjavascript');
const utils = ffjavascript.utils;
const {
  leBuff2int,
} = utils;

export const rbigint = (nbytes) => leBuff2int(crypto.randomBytes(nbytes))

