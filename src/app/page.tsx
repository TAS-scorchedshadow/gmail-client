import Link from "next/link";

import { auth } from "~/server/auth";
import EmailTest from "./_components/EmailTest";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return redirect("/api/auth/signin");
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center">
      <div className="flex w-full flex-col items-center gap-2">
        <div className="flex w-full flex-col items-center justify-center gap-4">
          <p className="text-center text-2xl">
            {session && <span>Logged in as {session.user?.name}</span>}
          </p>
          <EmailTest />
          <Link
            href={session ? "/api/auth/signout" : "/api/auth/signin"}
            className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
          >
            {session ? "Sign out" : "Sign in"}
          </Link>
        </div>
      </div>
    </main>
  );
}
