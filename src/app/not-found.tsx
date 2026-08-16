import Link from "next/link";
import { APP_ROUTES } from "@/lib/app-routes";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">Page not found</h1>
        <p className="text-sm text-slate-400">
          That URL is not one of the Cohold demo surfaces. Use the landing page or open the
          demo overview.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href={APP_ROUTES.home}
            className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900"
          >
            Landing
          </Link>
          <Link
            href={APP_ROUTES.overview}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500"
          >
            View Demo
          </Link>
        </div>
      </div>
    </div>
  );
}
