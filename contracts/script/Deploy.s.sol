// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {AnvilToken} from "../src/AnvilToken.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {StakingRevShare} from "../src/StakingRevShare.sol";
import {IdentityRegistry} from "../src/erc8004/IdentityRegistry.sol";
import {ReputationRegistry} from "../src/erc8004/ReputationRegistry.sol";

interface ICreateX {
    function deployCreate2(bytes32 salt, bytes memory initCode) external payable returns (address);
}

/// @notice Deploys Anvil + testnet ERC-8004 stand-ins. Addresses go in env vars,
/// never into application source.
///
///   TREASURY=<addr> forge script script/Deploy.s.sol --rpc-url https://testnet-rpc.monad.xyz --broadcast
///
/// CreateX addresses are deterministic — hash(salt, initCode) — so redeploying
/// with an unchanged salt and unchanged bytecode collides with the previous
/// deployment's address and reverts the whole script. Bump DEPLOY_NONCE (any
/// string) on every redeploy against the same chain to get fresh addresses
/// without touching source.
contract Deploy is Script {
    address constant CREATEX = 0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed;

    function run() external {
        address treasury = vm.envAddress("TREASURY");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        string memory nonce = vm.envOr("DEPLOY_NONCE", string("v1"));

        vm.startBroadcast(pk);

        address token = _deploy(
            keccak256(abi.encodePacked("anvil.token.", nonce)),
            abi.encodePacked(type(AnvilToken).creationCode, abi.encode(treasury))
        );
        address registry =
            _deploy(keccak256(abi.encodePacked("anvil.registry.", nonce)), type(AgentRegistry).creationCode);
        address staking = _deploy(
            keccak256(abi.encodePacked("anvil.staking.", nonce)),
            abi.encodePacked(type(StakingRevShare).creationCode, abi.encode(token, registry, treasury))
        );
        address identity = _deploy(
            keccak256(abi.encodePacked("anvil.erc8004.identity.", nonce)), type(IdentityRegistry).creationCode
        );
        address reputation = _deploy(
            keccak256(abi.encodePacked("anvil.erc8004.reputation.", nonce)),
            abi.encodePacked(type(ReputationRegistry).creationCode, abi.encode(identity))
        );

        vm.stopBroadcast();

        console.log("AnvilToken          ", token);
        console.log("AgentRegistry       ", registry);
        console.log("StakingRevShare     ", staking);
        console.log("IdentityRegistry    ", identity);
        console.log("ReputationRegistry  ", reputation);
        console.log("");
        console.log("M402_TOKEN_ADDRESS=", token);
        console.log("M402_PAY_TO=", staking);
        console.log("NEXT_PUBLIC_ANVL_TOKEN=", token);
        console.log("NEXT_PUBLIC_AGENT_REGISTRY=", registry);
        console.log("NEXT_PUBLIC_STAKING_REV_SHARE=", staking);
        console.log("NEXT_PUBLIC_IDENTITY_REGISTRY=", identity);
        console.log("NEXT_PUBLIC_REPUTATION_REGISTRY=", reputation);
    }

    function _deploy(bytes32 salt, bytes memory initCode) internal returns (address addr) {
        if (CREATEX.code.length > 0) {
            return ICreateX(CREATEX).deployCreate2(salt, initCode);
        }
        assembly {
            addr := create(0, add(initCode, 0x20), mload(initCode))
        }
        require(addr != address(0), "create failed");
    }
}
