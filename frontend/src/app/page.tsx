import MagicPlayPlace from '@/components/MagicPlayPlace';

export default function Home() {
  return (
    <>
      <MagicPlayPlace />
      <footer className="text-muted border-t px-7 py-3 text-center text-[11px]">
        © 2026 Magic Play Place · grown by{' '}
        <a href="https://vlivecapital.com/" target="_blank" rel="noopener noreferrer">
          Vlive Capital
        </a>{' '}
        (Pty) Ltd. Reg. 2026/569751/07
      </footer>
    </>
  );
}
