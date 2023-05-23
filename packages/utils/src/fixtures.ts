import fs from 'fs';
import path from 'path';
import { ZkComponents } from '.';

const snarkjs = require('snarkjs');

export async function fetchComponentsFromFilePaths(
  wasmPath: string,
  witnessCalculatorPath: string,
  zkeyPath: string
): Promise<ZkComponents> {
  const wasm: Buffer = fs.readFileSync(pr(wasmPath));
  const witnessCalculatorGenerator = await import(witnessCalculatorPath);
  const witnessCalculator = await witnessCalculatorGenerator.default(wasm);
  const zkeyBuffer: Buffer = fs.readFileSync(pr(zkeyPath));
  const zkey: Uint8Array = new Uint8Array(
    zkeyBuffer.buffer.slice(zkeyBuffer.byteOffset, zkeyBuffer.byteOffset + zkeyBuffer.byteLength)
  );

  return {
    wasm,
    witnessCalculator,
    zkey,
  };
}

const ZKEY_NAME = 'circuit_final.zkey';
const WITNESS_CALCULATOR_NAME = 'witness_calculator.cjs';

const VANCHOR_DIR = (ins: number) => `vanchor_${ins}`;
const VANCHOR_WASM = (ins: number, size: number) => `poseidon_vanchor_${ins}_${size}.wasm`;

const VANCHOR_FOREST_DIR = (ins: number) => `vanchor_forest_${ins}`;
const VANCHOR_FOREST_WASM = (ins: number, size: number) =>
  `${VANCHOR_FOREST_DIR(ins)}_${ins}_${size}.wasm`;

// path.resolve(...)
const pr = (pathStr: string) => path.resolve(__dirname, pathStr);
// snarkjs.zKey.exportVerificationKey(...)
const expVkey = async (pathStr: string) => await snarkjs.zKey.exportVerificationKey(pr(pathStr));

export const vanchorFixtures = (prefix) => ({
  prove_2_2: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${VANCHOR_DIR(2)}/2/${ZKEY_NAME}`), witness),
  vkey_2_2: async () => await expVkey(pr(`${prefix}/${VANCHOR_DIR(2)}/2/${ZKEY_NAME}`)),
  2_2: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${VANCHOR_DIR(2)}/2/${VANCHOR_WASM(2, 2)}`),
      pr(`${prefix}/${VANCHOR_DIR(2)}/2/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${VANCHOR_DIR(2)}/2/${ZKEY_NAME}`)
    ),
  prove_16_2: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${VANCHOR_DIR(16)}/2/${ZKEY_NAME}`), witness),
  vkey_16_2: async () => await expVkey(pr(`${prefix}/${VANCHOR_DIR(16)}/2/${ZKEY_NAME}`)),
  16_2: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${VANCHOR_DIR(16)}/2/${VANCHOR_WASM(16, 2)}`),
      pr(`${prefix}/${VANCHOR_DIR(16)}/2/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${VANCHOR_DIR(16)}/2/${ZKEY_NAME}`)
    ),
  prove_2_8: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${VANCHOR_DIR(2)}/8/${ZKEY_NAME}`), witness),
  vkey_2_8: async () => await expVkey(pr(`${prefix}/${VANCHOR_DIR(2)}/8/${ZKEY_NAME}`)),
  2_8: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${VANCHOR_DIR(2)}/8/${VANCHOR_WASM(2, 8)}`),
      pr(`${prefix}/${VANCHOR_DIR(2)}/8/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${VANCHOR_DIR(2)}/8/${ZKEY_NAME}`)
    ),
  prove_16_8: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${VANCHOR_DIR(16)}/8/${ZKEY_NAME}`), witness),
  vkey_16_8: async () => await expVkey(pr(`${prefix}/${VANCHOR_DIR(16)}/8/${ZKEY_NAME}`)),
  16_8: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${VANCHOR_DIR(16)}/8/${VANCHOR_WASM(16, 8)}`),
      pr(`${prefix}/${VANCHOR_DIR(16)}/8/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${VANCHOR_DIR(16)}/8/${ZKEY_NAME}`)
    ),
});

export const vanchorForestFixtures = (prefix) => ({
  prove_2_2: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${VANCHOR_FOREST_DIR(2)}/2/${ZKEY_NAME}`), witness),
  vkey_2_2: async () => await expVkey(pr(`${prefix}/${VANCHOR_FOREST_DIR(2)}/2/${ZKEY_NAME}`)),
  2_2: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${VANCHOR_FOREST_DIR(2)}/2/${VANCHOR_FOREST_WASM(2, 2)}`),
      pr(`${prefix}/${VANCHOR_FOREST_DIR(2)}/2/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${VANCHOR_FOREST_DIR(2)}/2/${ZKEY_NAME}`)
    ),
  prove_16_2: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${VANCHOR_FOREST_DIR(16)}/2/${ZKEY_NAME}`), witness),
  vkey_16_2: async () => await expVkey(pr(`${prefix}/${VANCHOR_FOREST_DIR(16)}/2/${ZKEY_NAME}`)),
  16_2: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${VANCHOR_FOREST_DIR(16)}/2/${VANCHOR_FOREST_WASM(16, 2)}`),
      pr(`${prefix}/${VANCHOR_FOREST_DIR(16)}/2/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${VANCHOR_FOREST_DIR(16)}/2/${ZKEY_NAME}`)
    ),
  prove_2_8: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${VANCHOR_FOREST_DIR(2)}/8/${ZKEY_NAME}`), witness),
  vkey_2_8: async () => await expVkey(pr(`${prefix}/${VANCHOR_FOREST_DIR(2)}/8/${ZKEY_NAME}`)),
  2_8: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${VANCHOR_FOREST_DIR(2)}/8/${VANCHOR_FOREST_WASM(2, 8)}`),
      pr(`${prefix}/${VANCHOR_FOREST_DIR(2)}/8/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${VANCHOR_FOREST_DIR(2)}/8/${ZKEY_NAME}`)
    ),
  prove_16_8: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${VANCHOR_FOREST_DIR(16)}/8/${ZKEY_NAME}`), witness),
  vkey_16_8: async () => await expVkey(pr(`${prefix}/${VANCHOR_FOREST_DIR(16)}/8/${ZKEY_NAME}`)),
  16_8: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${VANCHOR_FOREST_DIR(16)}/8/${VANCHOR_FOREST_WASM(16, 8)}`),
      pr(`${prefix}/${VANCHOR_FOREST_DIR(16)}/8/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${VANCHOR_FOREST_DIR(16)}/8/${ZKEY_NAME}`)
    ),
});
