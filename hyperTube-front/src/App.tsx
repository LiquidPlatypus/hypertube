import RetroTvFinal from "./components/RetroTvFinal";

function App() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen w-screen
             bg-[url('/fond.png')] bg-repeat bg-center">
      
      <div className="relative w-[95vw] max-w-[95rem] aspect-square flex items-center justify-center">
        <RetroTvFinal
          videoSrc="/screen2.mp4"
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
