// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AgentRegistry} from "./AgentRegistry.sol";

/// @notice Stake $ANVL on an agent. Revenue splits 50/30/20 in the same tx as
/// the M402 payment. Accumulator (MasterChef) so `distribute` is O(1) — never
/// loop stakers; a cold SLOAD is 8,100 gas on Monad.
contract StakingRevShare is Ownable, ReentrancyGuard {
    uint256 public constant ACC_PRECISION = 1e18;
    uint256 public constant CREATOR_BPS = 5_000; // 50%
    uint256 public constant STAKER_BPS = 3_000; // 30%
    uint256 public constant BPS = 10_000;

    IERC20 public immutable token;
    AgentRegistry public immutable registry;

    address public treasury;

    struct Pool {
        uint256 totalStaked;
        uint256 accRewardPerShare;
    }

    struct Position {
        uint256 amount;
        uint256 rewardDebt;
    }

    mapping(bytes32 agentId => Pool) public pools;
    mapping(bytes32 agentId => mapping(address staker => Position)) public positions;

    event Staked(bytes32 indexed agentId, address indexed staker, uint256 amount);
    event Unstaked(bytes32 indexed agentId, address indexed staker, uint256 amount);
    event Claimed(bytes32 indexed agentId, address indexed staker, uint256 amount);
    event Distributed(
        bytes32 indexed agentId, uint256 amount, uint256 creatorAmt, uint256 stakerAmt, uint256 treasuryAmt
    );
    event TreasuryUpdated(address indexed treasury);

    error ZeroAmount();
    error ZeroAddress();
    error AgentNotActive();
    error InsufficientStake();

    constructor(IERC20 token_, AgentRegistry registry_, address treasury_) Ownable(msg.sender) {
        if (address(token_) == address(0) || address(registry_) == address(0) || treasury_ == address(0)) {
            revert ZeroAddress();
        }
        token = token_;
        registry = registry_;
        treasury = treasury_;
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    function stake(bytes32 agentId, uint256 amount) public nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _requireActive(agentId);
        _harvest(agentId, msg.sender);
        token.transferFrom(msg.sender, address(this), amount);
        Pool storage pool = pools[agentId];
        Position storage pos = positions[agentId][msg.sender];
        pos.amount += amount;
        pool.totalStaked += amount;
        pos.rewardDebt = (pos.amount * pool.accRewardPerShare) / ACC_PRECISION;
        emit Staked(agentId, msg.sender, amount);
    }

    /// @notice Permit + stake in one tx — the Store staking modal's path.
    function stakeWithPermit(
        bytes32 agentId,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        IERC20Permit(address(token)).permit(msg.sender, address(this), amount, deadline, v, r, s);
        stake(agentId, amount);
    }

    function unstake(bytes32 agentId, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Position storage pos = positions[agentId][msg.sender];
        if (pos.amount < amount) revert InsufficientStake();
        _harvest(agentId, msg.sender);
        pos.amount -= amount;
        pools[agentId].totalStaked -= amount;
        pos.rewardDebt = (pos.amount * pools[agentId].accRewardPerShare) / ACC_PRECISION;
        token.transfer(msg.sender, amount);
        emit Unstaked(agentId, msg.sender, amount);
    }

    function claim(bytes32 agentId) external nonReentrant {
        _harvest(agentId, msg.sender);
    }

    /// @notice Pull `amount` from the caller and split 50/30/20. Used when the
    /// payer has already approved this contract (or the caller is the payer).
    function distribute(bytes32 agentId, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _requireActive(agentId);
        token.transferFrom(msg.sender, address(this), amount);
        _split(agentId, amount);
    }

    /// @notice One-tx M402 settlement: permit + pull + 50/30/20. The permit's
    /// spender must be this contract. Facilitator submits and pays gas.
    function settle(
        bytes32 agentId,
        address payer,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _requireActive(agentId);
        IERC20Permit(address(token)).permit(payer, address(this), amount, deadline, v, r, s);
        token.transferFrom(payer, address(this), amount);
        _split(agentId, amount);
    }

    function pendingReward(bytes32 agentId, address staker) public view returns (uint256) {
        Position storage pos = positions[agentId][staker];
        uint256 accumulated = (pos.amount * pools[agentId].accRewardPerShare) / ACC_PRECISION;
        if (accumulated <= pos.rewardDebt) return 0;
        return accumulated - pos.rewardDebt;
    }

    function _requireActive(bytes32 agentId) internal view {
        (, , bool active) = registry.getAgent(agentId);
        if (!active) revert AgentNotActive();
    }

    function _harvest(bytes32 agentId, address staker) internal {
        Position storage pos = positions[agentId][staker];
        uint256 pending = pendingReward(agentId, staker);
        pos.rewardDebt = (pos.amount * pools[agentId].accRewardPerShare) / ACC_PRECISION;
        if (pending == 0) return;
        token.transfer(staker, pending);
        emit Claimed(agentId, staker, pending);
    }

    function _split(bytes32 agentId, uint256 amount) internal {
        (address creator,,) = registry.getAgent(agentId);
        uint256 creatorAmt = (amount * CREATOR_BPS) / BPS;
        uint256 stakerAmt = (amount * STAKER_BPS) / BPS;
        Pool storage pool = pools[agentId];

        if (pool.totalStaked == 0) {
            // Otherwise the 30% is stranded in the contract.
            stakerAmt = 0;
        } else {
            pool.accRewardPerShare += (stakerAmt * ACC_PRECISION) / pool.totalStaked;
        }

        uint256 treasuryAmt = amount - creatorAmt - stakerAmt;
        token.transfer(creator, creatorAmt);
        token.transfer(treasury, treasuryAmt);
        emit Distributed(agentId, amount, creatorAmt, stakerAmt, treasuryAmt);
    }
}
