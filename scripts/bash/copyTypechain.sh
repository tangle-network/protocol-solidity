#!/bin/bash

# Copy the latest locally generated types into the contracts package
# cp -a ./typechain/. packages/contracts/src/
mkdir -p packages/contracts/src/factories

cp ./typechain/AnchorBase.d.ts ./packages/contracts/src/AnchorBase.d.ts
cp ./typechain/AnchorHandler.d.ts ./packages/contracts/src/AnchorHandler.d.ts
cp ./typechain/SignatureBridge.d.ts ./packages/contracts/src/SignatureBridge.d.ts
cp ./typechain/common.d.ts ./packages/contracts/src/common.d.ts
cp ./typechain/ERC20.d.ts ./packages/contracts/src/ERC20.d.ts
cp ./typechain/ERC20PresetMinterPauser.d.ts ./packages/contracts/src/ERC20PresetMinterPauser.d.ts
cp ./typechain/GovernedTokenWrapper.d.ts ./packages/contracts/src/GovernedTokenWrapper.d.ts
cp ./typechain/HandlerHelpers.d.ts ./packages/contracts/src/HandlerHelpers.d.ts
cp ./typechain/TokenWrapper.d.ts ./packages/contracts/src/TokenWrapper.d.ts
cp ./typechain/TokenWrapperHandler.d.ts ./packages/contracts/src/TokenWrapperHandler.d.ts
cp ./typechain/Treasury.d.ts ./packages/contracts/src/Treasury.d.ts
cp ./typechain/TreasuryHandler.d.ts ./packages/contracts/src/TreasuryHandler.d.ts

cp ./typechain/KeccakHasher.d.ts ./packages/contracts/src/KeccakHasher.d.ts
cp ./typechain/PoseidonHasher.d.ts ./packages/contracts/src/PoseidonHasher.d.ts
cp ./typechain/PoseidonT3.d.ts ./packages/contracts/src/PoseidonT3.d.ts
cp ./typechain/PoseidonT6.d.ts ./packages/contracts/src/PoseidonT6.d.ts
cp ./typechain/MerkleTree.d.ts ./packages/contracts/src/MerkleTree.d.ts
cp ./typechain/MerkleTreeWithHistory.d.ts ./packages/contracts/src/MerkleTreeWithHistory.d.ts

cp ./typechain/VAnchor.d.ts ./packages/contracts/src/VAnchor.d.ts
cp ./typechain/VAnchorBase.d.ts ./packages/contracts/src/VAnchorBase.d.ts
cp ./typechain/VAnchorEncodeInputs.d.ts ./packages/contracts/src/VAnchorEncodeInputs.d.ts
cp ./typechain/VAnchorVerifier.d.ts ./packages/contracts/src/VAnchorVerifier.d.ts

cp ./typechain/IdentityVAnchor.d.ts ./packages/contracts/src/IdentityVAnchor.d.ts
cp ./typechain/IdentityVAnchorBase.d.ts ./packages/contracts/src/IdentityVAnchorBase.d.ts
cp ./typechain/IdentityVAnchorEncodeInputs.d.ts ./packages/contracts/src/IdentityVAnchorEncodeInputs.d.ts
cp ./typechain/IdentityVAnchorVerifier.d.ts ./packages/contracts/src/IdentityVAnchorVerifier.d.ts

cp ./typechain/Verifier.d.ts ./packages/contracts/src/Verifier.d.ts
cp ./typechain/Verifier2.d.ts ./packages/contracts/src/Verifier2.d.ts
cp ./typechain/Verifier3.d.ts ./packages/contracts/src/Verifier3.d.ts
cp ./typechain/Verifier4.d.ts ./packages/contracts/src/Verifier4.d.ts
cp ./typechain/Verifier5.d.ts ./packages/contracts/src/Verifier5.d.ts
cp ./typechain/Verifier6.d.ts ./packages/contracts/src/Verifier6.d.ts
cp ./typechain/Verifier22.d.ts ./packages/contracts/src/Verifier22.d.ts
cp ./typechain/Verifier82.d.ts ./packages/contracts/src/Verifier82.d.ts
cp ./typechain/Verifier216.d.ts ./packages/contracts/src/Verifier216.d.ts
cp ./typechain/Verifier816.d.ts ./packages/contracts/src/Verifier816.d.ts

cp ./typechain/VerifierID22.d.ts ./packages/contracts/src/VerifierID22.d.ts
cp ./typechain/VerifierID82.d.ts ./packages/contracts/src/VerifierID82.d.ts
cp ./typechain/VerifierID216.d.ts ./packages/contracts/src/VerifierID216.d.ts
cp ./typechain/VerifierID816.d.ts ./packages/contracts/src/VerifierID816.d.ts

cp ./typechain/factories/AnchorBase__factory.ts ./packages/contracts/src/factories/AnchorBase__factory.ts
cp ./typechain/factories/AnchorHandler__factory.ts ./packages/contracts/src/factories/AnchorHandler__factory.ts
cp ./typechain/factories/SignatureBridge__factory.ts ./packages/contracts/src/factories/SignatureBridge__factory.ts
cp ./typechain/factories/ERC20__factory.ts ./packages/contracts/src/factories/ERC20__factory.ts
cp ./typechain/factories/ERC20PresetMinterPauser__factory.ts ./packages/contracts/src/factories/ERC20PresetMinterPauser__factory.ts
cp ./typechain/factories/GovernedTokenWrapper__factory.ts ./packages/contracts/src/factories/GovernedTokenWrapper__factory.ts
cp ./typechain/factories/HandlerHelpers__factory.ts ./packages/contracts/src/factories/HandlerHelpers__factory.ts
cp ./typechain/factories/TokenWrapper__factory.ts ./packages/contracts/src/factories/TokenWrapper__factory.ts
cp ./typechain/factories/TokenWrapperHandler__factory.ts ./packages/contracts/src/factories/TokenWrapperHandler__factory.ts
cp ./typechain/factories/Treasury__factory.ts ./packages/contracts/src/factories/Treasury__factory.ts
cp ./typechain/factories/TreasuryHandler__factory.ts ./packages/contracts/src/factories/TreasuryHandler__factory.ts

cp ./typechain/factories/KeccakHasher__factory.ts ./packages/contracts/src/factories/KeccakHasher__factory.ts
cp ./typechain/factories/PoseidonHasher__factory.ts ./packages/contracts/src/factories/PoseidonHasher__factory.ts
cp ./typechain/factories/PoseidonT3__factory.ts ./packages/contracts/src/factories/PoseidonT3__factory.ts
cp ./typechain/factories/PoseidonT6__factory.ts ./packages/contracts/src/factories/PoseidonT6__factory.ts
cp ./typechain/factories/MerkleTree__factory.ts ./packages/contracts/src/factories/MerkleTree__factory.ts
cp ./typechain/factories/MerkleTreeWithHistory__factory.ts ./packages/contracts/src/factories/MerkleTreeWithHistory__factory.ts

cp ./typechain/factories/VAnchor__factory.ts ./packages/contracts/src/factories/VAnchor__factory.ts
cp ./typechain/factories/VAnchorBase__factory.ts ./packages/contracts/src/factories/VAnchorBase__factory.ts
cp ./typechain/factories/VAnchorEncodeInputs__factory.ts ./packages/contracts/src/factories/VAnchorEncodeInputs__factory.ts
cp ./typechain/factories/VAnchorVerifier__factory.ts ./packages/contracts/src/factories/VAnchorVerifier__factory.ts

cp ./typechain/factories/OpenVAnchor__factory.ts ./packages/contracts/src/factories/OpenVAnchor__factory.ts
cp ./typechain/factories/OpenVAnchorBase__factory.ts ./packages/contracts/src/factories/OpenVAnchorBase__factory.ts
cp ./typechain/factories/OpenAnchorBase__factory.ts ./packages/contracts/src/factories/OpenAnchorBase__factory.ts
cp ./typechain/factories/OpenLinkableAnchor__factory.ts ./packages/contracts/src/factories/OpenLinkableAnchor__factory.ts

cp ./typechain/factories/IdentityVAnchor__factory.ts ./packages/contracts/src/factories/IdentityVAnchor__factory.ts
cp ./typechain/factories/IdentityVAnchorBase__factory.ts ./packages/contracts/src/factories/IdentityVAnchorBase__factory.ts
cp ./typechain/factories/IdentityVAnchorEncodeInputs__factory.ts ./packages/contracts/src/factories/IdentityVAnchorEncodeInputs__factory.ts
cp ./typechain/factories/IdentityVAnchorVerifier__factory.ts ./packages/contracts/src/factories/IdentityVAnchorVerifier__factory.ts

cp ./typechain/factories/Verifier__factory.ts ./packages/contracts/src/factories/Verifier__factory.ts
cp ./typechain/factories/Verifier2__factory.ts ./packages/contracts/src/factories/Verifier2__factory.ts
cp ./typechain/factories/Verifier3__factory.ts ./packages/contracts/src/factories/Verifier3__factory.ts
cp ./typechain/factories/Verifier4__factory.ts ./packages/contracts/src/factories/Verifier4__factory.ts
cp ./typechain/factories/Verifier5__factory.ts ./packages/contracts/src/factories/Verifier5__factory.ts
cp ./typechain/factories/Verifier6__factory.ts ./packages/contracts/src/factories/Verifier6__factory.ts
cp ./typechain/factories/Verifier22__factory.ts ./packages/contracts/src/factories/Verifier22__factory.ts
cp ./typechain/factories/Verifier82__factory.ts ./packages/contracts/src/factories/Verifier82__factory.ts
cp ./typechain/factories/Verifier216__factory.ts ./packages/contracts/src/factories/Verifier216__factory.ts
cp ./typechain/factories/Verifier816__factory.ts ./packages/contracts/src/factories/Verifier816__factory.ts

cp ./typechain/factories/VerifierID22__factory.ts ./packages/contracts/src/factories/VerifierID22__factory.ts
cp ./typechain/factories/VerifierID82__factory.ts ./packages/contracts/src/factories/VerifierID82__factory.ts
cp ./typechain/factories/VerifierID216__factory.ts ./packages/contracts/src/factories/VerifierID216__factory.ts
cp ./typechain/factories/VerifierID816__factory.ts ./packages/contracts/src/factories/VerifierID816__factory.ts
