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

const ID_VANCHOR_DIR = (ins: number) => `identity_vanchor_${ins}`;
const ID_VANCHOR_WASM = (ins: number, size: number) => `${ID_VANCHOR_DIR(ins)}_${size}.wasm`;

const MASP_VANCHOR_DIR = (ins: number) => `masp_vanchor_${ins}`;
const MASP_VANCHOR_WASM = (ins: number, size: number) => `${MASP_VANCHOR_DIR(ins)}_${size}.wasm`;

const MASP_SWAP_DIR = (w: number) => `swap_${w}`;
const MASP_SWAP_WASM = (w: number, depth: number) => `swap_${depth}_${w}.wasm`;

const MASP_REWARD_DIR = (w: number) => `reward_${w}`;
const MASP_REWARD_WASM = (w: number, depth: number) => `reward_${depth}_${w}.wasm`;

const BATCH_TREE_DIR = 'batch-tree';
const BATCH_TREE_WASM = (size: number) => `batchMerkleTreeUpdate_${size}.wasm`;

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

export const identityVAnchorFixtures = (prefix) => ({
  prove_2_2: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${ID_VANCHOR_DIR(2)}/2/${ZKEY_NAME}`), witness),
  vkey_2_2: async () => await expVkey(pr(`${prefix}/${ID_VANCHOR_DIR(2)}/2/${ZKEY_NAME}`)),
  2_2: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${ID_VANCHOR_DIR(2)}/2/${ID_VANCHOR_WASM(2, 2)}`),
      pr(`${prefix}/${ID_VANCHOR_DIR(2)}/2/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${ID_VANCHOR_DIR(2)}/2/${ZKEY_NAME}`)
    ),
  prove_16_2: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${ID_VANCHOR_DIR(16)}/2/${ZKEY_NAME}`), witness),
  vkey_16_2: async () => await expVkey(pr(`${prefix}/${ID_VANCHOR_DIR(16)}/2/${ZKEY_NAME}`)),
  16_2: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${ID_VANCHOR_DIR(16)}/2/${ID_VANCHOR_WASM(16, 2)}`),
      pr(`${prefix}/${ID_VANCHOR_DIR(16)}/2/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${ID_VANCHOR_DIR(16)}/2/${ZKEY_NAME}`)
    ),
  prove_2_8: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${ID_VANCHOR_DIR(2)}/8/${ZKEY_NAME}`), witness),
  vkey_2_8: async () => await expVkey(pr(`${prefix}/${ID_VANCHOR_DIR(2)}/8/${ZKEY_NAME}`)),
  2_8: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${ID_VANCHOR_DIR(2)}/8/${ID_VANCHOR_WASM(2, 8)}`),
      pr(`${prefix}/${ID_VANCHOR_DIR(2)}/8/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${ID_VANCHOR_DIR(2)}/8/${ZKEY_NAME}`)
    ),
  prove_16_8: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${ID_VANCHOR_DIR(16)}/8/${ZKEY_NAME}`), witness),
  vkey_16_8: async () => await expVkey(pr(`${prefix}/${ID_VANCHOR_DIR(16)}/8/${ZKEY_NAME}`)),
  16_8: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${ID_VANCHOR_DIR(16)}/8/${ID_VANCHOR_WASM(16, 8)}`),
      pr(`${prefix}/${ID_VANCHOR_DIR(16)}/8/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${ID_VANCHOR_DIR(16)}/8/${ZKEY_NAME}`)
    ),
});

export const maspVAnchorFixtures = (prefix) => ({
  prove_2_2: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${MASP_VANCHOR_DIR(2)}/2/${ZKEY_NAME}`), witness),
  vkey_2_2: async () => await expVkey(pr(`${prefix}/${MASP_VANCHOR_DIR(2)}/2/${ZKEY_NAME}`)),
  2_2: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${MASP_VANCHOR_DIR(2)}/2/${MASP_VANCHOR_WASM(2, 2)}`),
      pr(`${prefix}/${MASP_VANCHOR_DIR(2)}/2/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${MASP_VANCHOR_DIR(2)}/2/${ZKEY_NAME}`)
    ),
  prove_16_2: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${MASP_VANCHOR_DIR(16)}/2/${ZKEY_NAME}`), witness),
  vkey_16_2: async () => await expVkey(pr(`${prefix}/${MASP_VANCHOR_DIR(16)}/2/${ZKEY_NAME}`)),
  16_2: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${MASP_VANCHOR_DIR(16)}/2/${MASP_VANCHOR_WASM(16, 2)}`),
      pr(`${prefix}/${MASP_VANCHOR_DIR(16)}/2/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${MASP_VANCHOR_DIR(16)}/2/${ZKEY_NAME}`)
    ),
  prove_2_8: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${MASP_VANCHOR_DIR(2)}/8/${ZKEY_NAME}`), witness),
  vkey_2_8: async () => await expVkey(pr(`${prefix}/${MASP_VANCHOR_DIR(2)}/8/${ZKEY_NAME}`)),
  2_8: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${MASP_VANCHOR_DIR(2)}/8/${MASP_VANCHOR_WASM(2, 8)}`),
      pr(`${prefix}/${MASP_VANCHOR_DIR(2)}/8/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${MASP_VANCHOR_DIR(2)}/8/${ZKEY_NAME}`)
    ),
  prove_16_8: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${MASP_VANCHOR_DIR(16)}/8/${ZKEY_NAME}`), witness),
  vkey_16_8: async () => await expVkey(pr(`${prefix}/${MASP_VANCHOR_DIR(16)}/8/${ZKEY_NAME}`)),
  16_8: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${MASP_VANCHOR_DIR(16)}/8/${MASP_VANCHOR_WASM(16, 8)}`),
      pr(`${prefix}/${MASP_VANCHOR_DIR(16)}/8/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${MASP_VANCHOR_DIR(16)}/8/${ZKEY_NAME}`)
    ),
});

export const maspSwapFixtures = (prefix) => ({
  prove_2_20: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${MASP_SWAP_DIR(2)}/20/${ZKEY_NAME}`), witness),
  vkey_2_20: async () => await expVkey(pr(`${prefix}/${MASP_SWAP_DIR(2)}/20/${ZKEY_NAME}`)),
  2_20: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${MASP_SWAP_DIR(2)}/20/${MASP_SWAP_WASM(2, 20)}`),
      pr(`${prefix}/${MASP_SWAP_DIR(2)}/20/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${MASP_SWAP_DIR(2)}/20/${ZKEY_NAME}`)
    ),
  prove_2_30: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${MASP_SWAP_DIR(2)}/30/${ZKEY_NAME}`), witness),
  vkey_2_30: async () => await expVkey(pr(`${prefix}/${MASP_SWAP_DIR(2)}/30/${ZKEY_NAME}`)),
  2_30: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${MASP_SWAP_DIR(2)}/30/${MASP_SWAP_WASM(2, 30)}`),
      pr(`${prefix}/${MASP_SWAP_DIR(2)}/30/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${MASP_SWAP_DIR(2)}/30/${ZKEY_NAME}`)
    ),
});

export const maspRewardFixtures = (prefix) => ({
  prove_2_30: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${MASP_REWARD_DIR(2)}/30/${ZKEY_NAME}`), witness),
  vkey_2_30: async () => await expVkey(pr(`${prefix}/${MASP_REWARD_DIR(2)}/30/${ZKEY_NAME}`)),
  2_30: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${MASP_REWARD_DIR(2)}/30/${MASP_REWARD_WASM(2, 30)}`),
      pr(`${prefix}/${MASP_REWARD_DIR(2)}/30/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${MASP_REWARD_DIR(2)}/30/${ZKEY_NAME}`)
    ),
  prove_8_30: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${MASP_REWARD_DIR(2)}/30/${ZKEY_NAME}`), witness),
  vkey_8_30: async () => await expVkey(pr(`${prefix}/${MASP_REWARD_DIR(2)}/30/${ZKEY_NAME}`)),
  8_30: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${MASP_REWARD_DIR(2)}/30/${MASP_REWARD_WASM(8, 30)}`),
      pr(`${prefix}/${MASP_REWARD_DIR(2)}/30/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${MASP_REWARD_DIR(2)}/30/${ZKEY_NAME}`)
    ),
});

export const batchTreeFixtures = (prefix) => ({
  prove_4: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${BATCH_TREE_DIR}/4/${ZKEY_NAME}`), witness),
  vkey_4: async () => await expVkey(pr(`${prefix}/${BATCH_TREE_DIR}/4/${ZKEY_NAME}`)),
  4: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${BATCH_TREE_DIR}/4/${BATCH_TREE_WASM(4)}`),
      pr(`${prefix}/${BATCH_TREE_DIR}/4/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${BATCH_TREE_DIR}/4/${ZKEY_NAME}`)
    ),
  prove_8: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${BATCH_TREE_DIR}/8/${ZKEY_NAME}`), witness),
  vkey_8: async () => await expVkey(pr(`${prefix}/${BATCH_TREE_DIR}/8/${ZKEY_NAME}`)),
  8: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${BATCH_TREE_DIR}/8/${BATCH_TREE_WASM(8)}`),
      pr(`${prefix}/${BATCH_TREE_DIR}/8/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${BATCH_TREE_DIR}/8/${ZKEY_NAME}`)
    ),
  prove_16: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${BATCH_TREE_DIR}/16/${ZKEY_NAME}`), witness),
  vkey_16: async () => await expVkey(pr(`${prefix}/${BATCH_TREE_DIR}/16/${ZKEY_NAME}`)),
  16: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${BATCH_TREE_DIR}/16/${BATCH_TREE_WASM(16)}`),
      pr(`${prefix}/${BATCH_TREE_DIR}/16/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${BATCH_TREE_DIR}/16/${ZKEY_NAME}`)
    ),
  prove_32: async (witness) =>
    snarkjs.groth16.prove(pr(`${prefix}/${BATCH_TREE_DIR}/32/${ZKEY_NAME}`), witness),
  vkey_32: async () => await expVkey(pr(`${prefix}/${BATCH_TREE_DIR}/32/${ZKEY_NAME}`)),
  32: async () =>
    await fetchComponentsFromFilePaths(
      pr(`${prefix}/${BATCH_TREE_DIR}/32/${BATCH_TREE_WASM(32)}`),
      pr(`${prefix}/${BATCH_TREE_DIR}/32/${WITNESS_CALCULATOR_NAME}`),
      pr(`${prefix}/${BATCH_TREE_DIR}/32/${ZKEY_NAME}`)
    ),
});
