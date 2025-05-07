import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import MailPage from "./_components/mail/MailPage";

export default async function Home() {
  const session = await auth();

  if (!session) {
    return redirect("/api/auth/signin");
  }

  return (
    <main className="flex min-h-screen w-full">
      <MailPage user={session.user} />
      {/* <Link
        href={session ? "/api/auth/signout" : "/api/auth/signin"}
        className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
      >
        {session ? "Sign out" : "Sign in"}
      </Link> */}
    </main>
  );
}
