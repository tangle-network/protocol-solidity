// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19 <0.9.0;

import "../utils/ChainIdWithType.sol";

contract ProposalHelpers is ChainIdWithType {
    function buildTypedChainId(
        uint16 chainType,
        uint32 chainId
    ) public pure returns (bytes6) {
        // Return a 6 bytes value of the chainType and chainId concatenated
        return bytes6(uint48(chainType) << (4 * 8) | uint32(chainId));
    }

    function buildResourceId(
        address resource,
        bytes6 typedChainId
    ) public pure returns (bytes32) {
        // Return a 32 bytes value of the resource and typedChainId concatenated
        return (bytes32(uint256(uint160(resource)) << (6 * 8))) | bytes32(uint256(uint48(typedChainId)));
    }

    function buildProposalHeader(
        bytes32 resourceId,
        bytes4 functionSig,
        uint32 nonce
    ) public pure returns (bytes memory) {
        // Return a 40 bytes value of the resourceId, functionSig and nonce concatenated
        return abi.encodePacked(resourceId, functionSig, nonce);
    }

    function buildProposal(
        bytes memory proposalHeader,
        bytes memory proposalData
    ) public pure returns (bytes memory) {
        // Return a 40 + proposalData.length bytes value of the proposalHeader and proposalData concatenated
        return abi.encodePacked(proposalHeader, proposalData);
    }

    function buildAnchorUpdateProposal(
        bytes32 targetResourceId,
        bytes32 merkleRoot,
        uint32 leafIndex,
        bytes32 srcResourceId
    ) public pure returns (bytes memory) {
        // Create the proposal header with the leafIndex as the nonce
        bytes memory proposalHeader = buildProposalHeader(
            targetResourceId,
            bytes4(keccak256("updateEdge(uint256,uint32,bytes32)")),
            leafIndex
        );
        // Create the proposal data as the merkleRoot + srcResourceId concatenated
        bytes memory proposalData = abi.encodePacked(merkleRoot, srcResourceId);
        // Return the proposal header and proposal data concatenated
        return buildProposal(proposalHeader, proposalData);
    }

    function buildSetResourceProposal(
        bytes32 bridgeResourceId,
		uint32 nonce,
		bytes32 newResourceId,
		address handlerAddress
    ) public pure returns (bytes memory) {
        // Create the proposal header with the resourceId as the nonce
        bytes memory proposalHeader = buildProposalHeader(
            bridgeResourceId,
            bytes4(keccak256("adminSetResourceWithSignature(bytes32,bytes4,uint32,bytes32,address,bytes)")),
            nonce
        );
        // Create the proposal data as the newResourceId + handlerAddress concatenated
        bytes memory proposalData = abi.encodePacked(newResourceId, handlerAddress);
        // Return the proposal header and proposal data concatenated
        return buildProposal(proposalHeader, proposalData);
    }
}
