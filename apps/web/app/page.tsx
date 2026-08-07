import Link from "next/link";
import { DitherGradient } from "@/components/dither-kit/gradient";
import { Orb } from "@/components/orb/Orb";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45vh]">
        <DitherGradient from="blue" direction="up" opacity={0.35} />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[520px] flex-col items-center justify-center px-6 text-center">
        <div className="rise-in flex flex-col items-center gap-5">
          <Orb size={36} label="air" />
          <h1 className="m-0 text-[44px] font-semibold leading-none tracking-[-0.03em]">
            air
          </h1>
          <p className="m-0 max-w-[360px] text-[15px] leading-relaxed text-muted-2">
            Your personal agent — its own number, its own inbox, and its own
            computer. Tied to exactly one person: you.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Link className="btn" href="/login">
              Sign in
            </Link>
          </div>
        </div>

        <div className="rise-in mt-16 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            ["A number", "Text it like a friend — it answers on iMessage."],
            ["An inbox", "Its own email address, working around the clock."],
            ["A computer", "A real machine that remembers everything for you."],
          ].map(([title, body]) => (
            <div key={title} className="panel !p-4 text-left">
              <h2 className="m-0 text-[13px] font-semibold">{title}</h2>
              <p className="mb-0 mt-1 text-[12px] leading-relaxed text-muted">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
