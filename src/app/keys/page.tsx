import type { Metadata } from "next";
import { DeployKeys } from "@/components/deploy-keys";
import { listKeys } from "@/lib/keys";

/** Reads the key file on every request — never prerender or cache. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Deploy keys · Anvil",
  description: "Create and revoke the keys that authenticate anvil deploy.",
};

export default function KeysPage() {
  return (
    <DeployKeys
      initialKeys={listKeys()}
      envKeySet={Boolean(process.env.ANVIL_DEPLOY_KEY)}
    />
  );
}
