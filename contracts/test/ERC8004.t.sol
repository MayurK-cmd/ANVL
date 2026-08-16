// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {IdentityRegistry} from "../src/erc8004/IdentityRegistry.sol";
import {ReputationRegistry, IIdentityRegistry} from "../src/erc8004/ReputationRegistry.sol";

contract ERC8004Test is Test {
    IdentityRegistry identity;
    ReputationRegistry reputation;

    address alice = address(0xA11CE);

    function setUp() public {
        identity = new IdentityRegistry();
        reputation = new ReputationRegistry(IIdentityRegistry(address(identity)));
    }

    function test_registerMintsSequentialIds() public {
        vm.prank(alice);
        uint256 a = identity.register("ipfs://alice");
        vm.prank(alice);
        uint256 b = identity.register();
        assertEq(a, 1);
        assertEq(b, 2);
        assertEq(identity.ownerOf(1), alice);
        assertEq(identity.tokenURI(1), "ipfs://alice");
    }

    function test_feedbackAverage() public {
        vm.prank(alice);
        uint256 agentId = identity.register("ipfs://agent");
        vm.prank(alice);
        reputation.giveFeedback(agentId, 80, 0, "", "", "", "", bytes32(0));
        vm.prank(address(0xB0B));
        reputation.giveFeedback(agentId, 60, 0, "", "", "", "", bytes32(0));
        (uint64 count, int128 avg) = reputation.getSummary(agentId, new address[](0), "", "");
        assertEq(count, 2);
        assertEq(avg, 70);
    }

    function test_feedbackRevertsIfAgentMissing() public {
        vm.expectRevert();
        reputation.giveFeedback(99, 1, 0, "", "", "", "", bytes32(0));
    }
}
