import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 480, margin: "20vh auto", padding: 16 }}>
      <h1>air</h1>
      <p className="muted">
        Your personal agent — its own number, inbox, and computer.
      </p>
      <Link className="btn" href="/login" style={{ display: "inline-block" }}>
        Sign in
      </Link>
    </main>
  );
}
