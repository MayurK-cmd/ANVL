// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";

contract AgentRegistryTest is Test {
    AgentRegistry registry;
    bytes32 id = keccak256("echo-v1");

    function setUp() public {
        registry = new AgentRegistry();
    }

    function test_registerStoresPackedFields() public {
        registry.register(id, "https://agent.example/send", 0.01e18, "ipfs://meta", AgentRegistry.AgentType.API);
        (address owner, uint96 price, bool active) = registry.getAgent(id);
        assertEq(owner, address(this));
        assertEq(price, 0.01e18);
        assertTrue(active);
        (address o, uint96 p, AgentRegistry.AgentType t, bool a, string memory uri, string memory meta) =
            registry.agents(id);
        assertEq(o, address(this));
        assertEq(p, 0.01e18);
        assertEq(uint8(t), uint8(AgentRegistry.AgentType.API));
        assertTrue(a);
        assertEq(uri, "https://agent.example/send");
        assertEq(meta, "ipfs://meta");
    }

    function test_cannotRegisterTwice() public {
        registry.register(id, "u", 1, "m", AgentRegistry.AgentType.BROWSER);
        vm.expectRevert(AgentRegistry.AlreadyRegistered.selector);
        registry.register(id, "u", 1, "m", AgentRegistry.AgentType.BROWSER);
    }

    function test_onlyOwnerUpdatesPriceAndDeactivates() public {
        registry.register(id, "u", 1, "m", AgentRegistry.AgentType.SITEMAP);
        registry.updatePrice(id, 2);
        (, uint96 price,) = registry.getAgent(id);
        assertEq(price, 2);

        vm.prank(address(0xBAD));
        vm.expectRevert(AgentRegistry.NotOwner.selector);
        registry.updatePrice(id, 3);

        registry.deactivate(id);
        (,, bool active) = registry.getAgent(id);
        assertFalse(active);
    }

    function test_getAgentRevertsUnknown() public {
        vm.expectRevert(AgentRegistry.UnknownAgent.selector);
        registry.getAgent(id);
    }
}
