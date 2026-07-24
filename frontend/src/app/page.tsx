import MagicPlayPlace from '@/components/MagicPlayPlace';

export default function Home() {
  return (
    <>
      <MagicPlayPlace />
      <footer className="border-t border-white/[0.06] px-4 py-2 text-center text-[10px] text-white/30">
        © 2026 Magic Play Place by{' '}
        <a
          href="https://vlivecapital.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-white/50"
        >
          Vlive Capital
        </a>{' '}
        (Pty) Ltd. Reg. 2026/569751/07
      </footer>
    </>
  );
}

