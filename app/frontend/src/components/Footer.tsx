export default function Header() {
  return (
    <header className="relative w-full bg-black/90 text-amber-200 font-mono p-4 flex justify-center items-center shadow-[0_0_10px_#ffbf00]">
      <h1 className="text-2xl">RetroTube TV</h1>

      {/* Scanlines overlay */}
      <div className="absolute inset-0 pointer-events-none bg-black/10 [background-size:2px_2px]"></div>

      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none shadow-[0_0_15px_#ffbf00] rounded"></div>
    </header>
  );
}