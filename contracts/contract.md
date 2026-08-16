
| Contract | Role |
|---|---|
| `AnvilToken` | ERC-20 + EIP-2612 permit, 1B fixed supply, no mint/pause/blocklist |
| `AgentRegistry` | List API / browser / sitemap agents. Packed `owner + price`. `register` / `updatePrice` / `deactivate` |
| `StakingRevShare` | Stake, O(1) 50/30/20 split, `settle()` = permit + pull + split in one tx |
| `IdentityRegistry` + `ReputationRegistry` | Testnet ERC-8004 stand-ins. Same function names as mainnet so you only swap env vars at cutover |

`WorkflowRouter` is not in this cut — the PRD marks it as stretch.

When you have Foundry:

```bash
cd contracts
forge install --no-git foundry-rs/forge-std
forge install --no-git OpenZeppelin/openzeppelin-contracts
forge test --gas-report
```

Deploy to Monad Testnet (CreateX if that code is on the chain, otherwise `CREATE`):

```bash
TREASURY=0x... PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url https://testnet-rpc.monad.xyz --broadcast
```

Paste the printed addresses into `.env`. Point `M402_PAY_TO` at `StakingRevShare`, and make the permit `spender` that same address — `settle()` is the one-tx payment path.