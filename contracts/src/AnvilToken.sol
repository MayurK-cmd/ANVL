// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @notice $ANVL — fixed-supply payment + staking token. Permit is mandatory:
/// M402 authorizes transfers with a signature so the payer never needs MON.
/// No mint, pause, or blocklist after deployment.
contract AnvilToken is ERC20, ERC20Permit {
    uint256 public constant SUPPLY = 1_000_000_000e18;

    constructor(address treasury) ERC20("Anvil", "ANVL") ERC20Permit("Anvil") {
        require(treasury != address(0), "zero treasury");
        _mint(treasury, SUPPLY);
    }
}
