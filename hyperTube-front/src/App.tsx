import Header from "./components/header";
import Footer from "./components/footer";
import RetroTv from "./components/RetroTv";

function App() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-between bg-[url('/fond.png')] bg-repeat bg-center">
      <Header />

      <div className="relative w-[95vw] max-w-[95rem] aspect-square flex items-center justify-center my-4">
        <RetroTv
          videoSrc="/screen2.mp4"
          tvImageSrc="/TV.png"
          tvWidth={6144}
          tvHeight={6144}
          screenX={1200}
          screenY={1750}
          screenWidth={2832}
          screenHeight={2593}
        />
      </div>

      <Footer />
    </div>
  );
}

export default App;

