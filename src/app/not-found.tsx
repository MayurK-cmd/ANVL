import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <h1 className="font-display text-3xl font-extrabold text-bone">Agent not found</h1>
      <p className="mt-3 text-steel">That listing is not in the local catalog.</p>
      <Link
        href="/agents"
        className="mt-6 inline-flex min-h-10 items-center text-ember underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
      >
        Back to Agents
      </Link>
    </div>
  );
}
