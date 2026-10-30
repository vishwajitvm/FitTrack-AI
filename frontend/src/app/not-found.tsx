import Link from "next/link";

export default function NotFound() {
  return (
    <div className="glass mx-auto mt-10 flex max-w-lg flex-col items-center rounded-3xl border px-8 py-12 text-center">
      <p className="text-hero text-6xl font-bold">404</p>
      <p className="mt-3 text-sm text-slate-600">This page doesn&apos;t exist.</p>
      <Link href="/" className="btn-3d mt-5 inline-flex min-h-[44px] items-center rounded-xl px-4 text-sm font-semibold text-white">
        Back to dashboard
      </Link>
    </div>
  );
}
