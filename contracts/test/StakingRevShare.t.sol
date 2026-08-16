// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AnvilToken} from "../src/AnvilToken.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {StakingRevShare} from "../src/StakingRevShare.sol";

contract StakingRevShareTest is Test {
    AnvilToken token;
    AgentRegistry registry;
    StakingRevShare staking;

    address treasury = address(0xFEE);
    address creator = address(0xC0DE);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    bytes32 id = keccak256("echo-v1");

    uint256 payerPk = 0xA11;
    address payer;

    function setUp() public {
        payer = vm.addr(payerPk);
        token = new AnvilToken(address(this));
        registry = new AgentRegistry();
        staking = new StakingRevShare(token, registry, treasury);

        vm.prank(creator);
        registry.register(id, "https://agent.example/send", 1e18, "ipfs://meta", AgentRegistry.AgentType.API);

        token.transfer(alice, 100e18);
        token.transfer(bob, 100e18);
        token.transfer(payer, 100e18);
        vm.prank(alice);
        token.approve(address(staking), type(uint256).max);
        vm.prank(bob);
        token.approve(address(staking), type(uint256).max);
    }

    function test_splitFiftyThirtyTwenty() public {
        vm.prank(alice);
        staking.stake(id, 100e18);

        token.approve(address(staking), 100e18);
        staking.distribute(id, 100e18);

        assertEq(token.balanceOf(creator), 50e18);
        assertEq(token.balanceOf(treasury), 20e18);
        assertEq(staking.pendingReward(id, alice), 30e18);
    }

    function test_accumulatorSplitsProRataAcrossTwoStakers() public {
        vm.prank(alice);
        staking.stake(id, 100e18);
        vm.prank(bob);
        staking.stake(id, 100e18);

        token.approve(address(staking), 100e18);
        staking.distribute(id, 100e18);

        assertEq(staking.pendingReward(id, alice), 15e18);
        assertEq(staking.pendingReward(id, bob), 15e18);

        vm.prank(alice);
        staking.claim(id);
        assertEq(token.balanceOf(alice), 15e18);
        assertEq(staking.pendingReward(id, alice), 0);
    }

    function test_zeroStakeRoutesStakerShareToTreasury() public {
        token.approve(address(staking), 100e18);
        staking.distribute(id, 100e18);
        assertEq(token.balanceOf(creator), 50e18);
        assertEq(token.balanceOf(treasury), 50e18);
        assertEq(staking.pendingReward(id, alice), 0);
    }

    function test_unstakeReturnsPrincipalAndPending() public {
        vm.prank(alice);
        staking.stake(id, 100e18);
        token.approve(address(staking), 100e18);
        staking.distribute(id, 100e18);

        vm.prank(alice);
        staking.unstake(id, 100e18);
        // 100 principal + 30 staker share
        assertEq(token.balanceOf(alice), 130e18);
        (uint256 amount,) = staking.positions(id, alice);
        assertEq(amount, 0);
    }

    function test_settlePermitPullsAndSplits() public {
        vm.prank(alice);
        staking.stake(id, 100e18);

        uint256 deadline = block.timestamp + 120;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(payerPk, payer, address(staking), 10e18, deadline);
        staking.settle(id, payer, 10e18, deadline, v, r, s);

        assertEq(token.balanceOf(creator), 5e18);
        assertEq(token.balanceOf(treasury), 2e18);
        assertEq(staking.pendingReward(id, alice), 3e18);
        assertEq(token.nonces(payer), 1);
    }

    function test_cannotStakeOnUnknownAgent() public {
        vm.prank(alice);
        vm.expectRevert(AgentRegistry.UnknownAgent.selector);
        staking.stake(keccak256("missing"), 1e18);
    }

    function test_cannotStakeOnDeactivatedAgent() public {
        vm.prank(creator);
        registry.deactivate(id);
        vm.prank(alice);
        vm.expectRevert(StakingRevShare.AgentNotActive.selector);
        staking.stake(id, 1e18);
    }

    function _signPermit(uint256 pk, address owner, address spender, uint256 value, uint256 deadline)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 inner = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                spender,
                value,
                token.nonces(owner),
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), inner));
        return vm.sign(pk, digest);
    }
}
