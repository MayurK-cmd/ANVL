// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AnvilToken} from "../src/AnvilToken.sol";

contract AnvilTokenTest is Test {
    AnvilToken token;
    address treasury = address(0xA11CE);

    function setUp() public {
        token = new AnvilToken(treasury);
    }

    function test_mintsFixedSupplyToTreasury() public view {
        assertEq(token.totalSupply(), 1_000_000_000e18);
        assertEq(token.balanceOf(treasury), 1_000_000_000e18);
        assertEq(token.name(), "Anvil");
        assertEq(token.symbol(), "ANVL");
        assertEq(token.decimals(), 18);
    }

    function test_rejectsZeroTreasury() public {
        vm.expectRevert("zero treasury");
        new AnvilToken(address(0));
    }

    function test_permitIncrementsNonce() public {
        uint256 pk = 0xBEEF;
        address owner = vm.addr(pk);
        vm.prank(treasury);
        token.transfer(owner, 1e18);

        uint256 deadline = block.timestamp + 120;
        (uint8 v, bytes32 r, bytes32 s) = _signPermit(pk, owner, address(this), 1e18, deadline);
        token.permit(owner, address(this), 1e18, deadline, v, r, s);
        assertEq(token.nonces(owner), 1);
        assertEq(token.allowance(owner, address(this)), 1e18);
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
