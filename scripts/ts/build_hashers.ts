const { ethers, overwriteArtifact } = require('hardhat');
const poseidonGenContract = require('circomlib/src/poseidon_gencontract.js');
const mimcGenContract = require('circomlib/src/mimcsponge_gencontract.js');

const buildPoseidon = async (numInputs: number) => {
	    await overwriteArtifact(`PoseidonT${numInputs + 1}`, poseidonGenContract.createCode(numInputs));
}

const buildMiMC = async (numRounds: number) => {
	    await overwriteArtifact(`MiMCSponge${numRounds}`, mimcGenContract.createCode('mimcsponge', numRounds));
}

const buildPoseidonT3 = () => buildPoseidon(2);
// const buildPoseidonT4 = () => buildPoseidon(3);
// const buildPoseidonT5 = () => buildPoseidon(4);
// const buildPoseidonT6 = () => buildPoseidon(5);
const buildMiMCSponge220 = () => buildMiMC(220);

if (require.main === module) {
	    buildMiMCSponge220();
	        buildPoseidonT3();
		    // buildPoseidonT4();
		        // buildPoseidonT5();
			    // buildPoseidonT6();
}

export {
	    buildMiMCSponge220,
	        buildPoseidonT3,
		    // buildPoseidonT4,
		        // buildPoseidonT5,
			    // buildPoseidonT6,
}
