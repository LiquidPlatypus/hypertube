import RetroTvFinal from "./components/RetroTvFinal";

function App() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen w-screen
                     bg-[url('/bg80s-floral.svg')] bg-repeat">
      <h1 className="text-3xl font-bold mb-8 text-amber-100 font-mono">
        Hypertube Retro TV
      </h1>

      <div className="relative w-[95vw] max-w-full aspect-square flex items-center justify-center">
        <RetroTvFinal
          videoSrc="https://www.w3schools.com/html/mov_bbb.mp4"
          tvImageSrc="/TV.png"
          tvWidth={6144}
          tvHeight={6144}
          screenX={1200}
          screenY={1730}
          screenWidth={2832}
          screenHeight={2593}
        />
      </div>
    </main>
  );
}

export default App;
