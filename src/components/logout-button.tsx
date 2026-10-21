import { logoutAction } from "@/app/actions/auth";
import { Icon } from "./icons";

export function LogoutButton({ tone = "light" }: { tone?: "light" | "dark" }) {
  const cls =
    tone === "dark"
      ? "border-white/20 bg-transparent text-white hover:bg-white/10"
      : "border-line bg-white text-ink hover:border-primary/40 hover:bg-primary-soft";
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3.5 text-sm font-semibold transition ${cls}`}
      >
        <Icon name="logout" className="h-4 w-4" />
        Logout
      </button>
    </form>
  );
}
