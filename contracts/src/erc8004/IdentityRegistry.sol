// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @notice Testnet stand-in for the ERC-8004 IdentityRegistry. Same events and
/// `register` / `tokenURI` surface the Store reads. On mainnet cutover, point
/// the env var at `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` and delete the
/// deploy step — this contract is not the canonical registry.
contract IdentityRegistry is ERC721URIStorage {
    struct MetadataEntry {
        string metadataKey;
        bytes metadataValue;
    }

    uint256 private _lastId;
    mapping(uint256 agentId => mapping(string key => bytes value)) private _metadata;

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event MetadataSet(
        uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue
    );
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);

    constructor() ERC721("AgentIdentity", "AGENT") {}

    function register() external returns (uint256 agentId) {
        return _mintAgent("");
    }

    function register(string calldata agentURI) external returns (uint256 agentId) {
        return _mintAgent(agentURI);
    }

    function register(string calldata agentURI, MetadataEntry[] calldata metadata)
        external
        returns (uint256 agentId)
    {
        agentId = _mintAgent(agentURI);
        uint256 n = metadata.length;
        for (uint256 i; i < n; ++i) {
            _metadata[agentId][metadata[i].metadataKey] = metadata[i].metadataValue;
            emit MetadataSet(agentId, metadata[i].metadataKey, metadata[i].metadataKey, metadata[i].metadataValue);
        }
    }

    function setAgentURI(uint256 agentId, string calldata newURI) external {
        _requireAuthorized(agentId);
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external {
        _requireAuthorized(agentId);
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    function getMetadata(uint256 agentId, string calldata metadataKey) external view returns (bytes memory) {
        return _metadata[agentId][metadataKey];
    }

    function _mintAgent(string memory agentURI) internal returns (uint256 agentId) {
        agentId = ++_lastId;
        _safeMint(msg.sender, agentId);
        if (bytes(agentURI).length != 0) _setTokenURI(agentId, agentURI);
        emit Registered(agentId, agentURI, msg.sender);
    }

    function _requireAuthorized(uint256 agentId) internal view {
        address owner = ownerOf(agentId);
        require(
            msg.sender == owner || isApprovedForAll(owner, msg.sender) || msg.sender == getApproved(agentId),
            "not authorized"
        );
    }
}
