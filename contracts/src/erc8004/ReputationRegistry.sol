// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IIdentityRegistry {
    function ownerOf(uint256 agentId) external view returns (address);
}

/// @notice Testnet stand-in for the ERC-8004 ReputationRegistry. `giveFeedback`
/// / `getSummary` match the canonical signatures so the Store can swap the env
/// var to `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` at mainnet cutover.
/// ponytail: tag/client filters on getSummary are ignored; returns the global average.
contract ReputationRegistry {
    IIdentityRegistry public immutable identityRegistry;

    mapping(uint256 agentId => uint64 count) private _count;
    mapping(uint256 agentId => int256 sum) private _sum;
    mapping(uint256 agentId => mapping(address client => uint64 lastIndex)) public lastIndex;

    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals
    );

    constructor(IIdentityRegistry identityRegistry_) {
        require(address(identityRegistry_) != address(0), "zero registry");
        identityRegistry = identityRegistry_;
    }

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata,
        string calldata,
        string calldata,
        string calldata,
        bytes32
    ) external {
        identityRegistry.ownerOf(agentId); // reverts if unregistered
        uint64 index = ++lastIndex[agentId][msg.sender];
        _count[agentId] += 1;
        _sum[agentId] += int256(value);
        emit NewFeedback(agentId, msg.sender, index, value, valueDecimals);
    }

    function getSummary(uint256 agentId, address[] calldata, string calldata, string calldata)
        external
        view
        returns (uint64 count, int128 summaryValue)
    {
        count = _count[agentId];
        if (count == 0) return (0, 0);
        summaryValue = int128(_sum[agentId] / int256(uint256(count)));
    }
}
