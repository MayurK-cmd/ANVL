// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice On-chain listing for API agents, browser agents, and shared sitemaps.
/// Metadata (README, schemas, Webcmd defs) lives at `metadataURI` — a cold
/// SSTORE is 8,100 gas on Monad and users pay the gas limit, not gas used.
contract AgentRegistry {
    enum AgentType {
        API,
        BROWSER,
        SITEMAP
    }

    /// Packed: owner + price in slot 0, agentType + active in slot 1.
    struct Agent {
        address owner;
        uint96 price;
        AgentType agentType;
        bool active;
        string uri;
        string metadataURI;
    }

    mapping(bytes32 agentId => Agent) public agents;

    event Registered(
        bytes32 indexed agentId, address indexed owner, uint96 price, AgentType agentType, string uri, string metadataURI
    );
    event PriceUpdated(bytes32 indexed agentId, uint96 price);
    event Deactivated(bytes32 indexed agentId);

    error AlreadyRegistered();
    error NotOwner();
    error UnknownAgent();

    /// @dev `agentId` is `keccak256(bytes(name))` (or any stable bytes32 the Store uses).
    function register(
        bytes32 agentId,
        string calldata uri,
        uint96 price,
        string calldata metadataURI,
        AgentType agentType
    ) external {
        if (agents[agentId].owner != address(0)) revert AlreadyRegistered();
        agents[agentId] = Agent({
            owner: msg.sender,
            price: price,
            agentType: agentType,
            active: true,
            uri: uri,
            metadataURI: metadataURI
        });
        emit Registered(agentId, msg.sender, price, agentType, uri, metadataURI);
    }

    function updatePrice(bytes32 agentId, uint96 price) external {
        Agent storage agent = agents[agentId];
        if (agent.owner != msg.sender) revert NotOwner();
        agent.price = price;
        emit PriceUpdated(agentId, price);
    }

    function deactivate(bytes32 agentId) external {
        Agent storage agent = agents[agentId];
        if (agent.owner != msg.sender) revert NotOwner();
        agent.active = false;
        emit Deactivated(agentId);
    }

    /// @notice Tight getter for StakingRevShare — one external call, no strings.
    function getAgent(bytes32 agentId) external view returns (address owner, uint96 price, bool active) {
        Agent storage agent = agents[agentId];
        if (agent.owner == address(0)) revert UnknownAgent();
        return (agent.owner, agent.price, agent.active);
    }
}
