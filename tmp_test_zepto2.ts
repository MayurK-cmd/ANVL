import { runAgent } from "./src/lib/run-agent";
import { getAgent } from "./src/data/agents";

async function main() {
  const agent = getAgent("zepto-cart-v1")!;
  const result = await runAgent(agent, { request: "Add 2 bananas, 1 milk and 1 bread to my Zepto cart." });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
