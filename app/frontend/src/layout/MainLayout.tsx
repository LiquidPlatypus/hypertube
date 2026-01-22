import * as React from "react";
import { useState, useRef, useEffect } from "react";
import MainHeader from "../components/headers/MainHeader.tsx";
import MainFooter from "../components/footers/MainFooter.tsx";

import styles from "./MainLayout.module.css";
import TVRemote from "../components/TVRemote.tsx";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [isRemoteOpen, setIsRemoteOpen] = useState(false);

  const scrollerRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const [thumbTop, setThumbTop] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(40);

  const [fxEnabled, setFxEnabled] = useState(true);

  const handleToggleFx = () => {
    setFxEnabled((prev) => !prev);
  };

  const recalc = () => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!scroller || !track) return;

    const scrollHeight = scroller.scrollHeight;
    const clientHeight = scroller.clientHeight;
    const trackHeight = track.clientHeight;

    const ratio = clientHeight / scrollHeight;
    const h = Math.max(30, Math.floor(trackHeight * ratio));
    setThumbHeight(h);

    const maxScrollTop = scrollHeight - clientHeight;
    const maxThumbTop = trackHeight - h;
    const t = maxScrollTop <= 0 ? 0 : (scroller.scrollTop / maxScrollTop) * maxThumbTop;
    setThumbTop(t);
  };

  useEffect(() => {
    recalc();
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const onScroll = () => recalc();
    scroller.addEventListener("scroll", onScroll);

    const ro = new ResizeObserver(() => recalc());
    ro.observe(scroller);

    return () => {
      scroller.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, []);

  const onTrackClick = (e: React.MouseEvent) => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!scroller || !track) return;

    const rect = track.getBoundingClientRect();
    const clickY = e.clientY - rect.top;

    const targetThumbTop = clickY - thumbHeight / 2;
    const maxThumbTop = rect.height - thumbHeight;
    const clamped = Math.max(0, Math.min(maxThumbTop, targetThumbTop));

    const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
    scroller.scrollTop = maxThumbTop <= 0 ? 0 : (clamped / maxThumbTop) * maxScrollTop;
  };

  return (
    <div
      className={styles.MainLayout}
      style={{
        "--header-height": "20px",
        "--footer-height": "20px",
      } as React.CSSProperties}
    >
      <header className={styles.MainHeader}>
        <MainHeader />
      </header>

      <div className={styles.CRT}></div>
      {fxEnabled && <div className={styles.Scanline}></div>}


      <div className={styles.BackgroundWrapper}>
        <div className={styles.Background}></div>
      </div>

      <main ref={scrollerRef} className={styles.ScrollArea}>
        {children}
      </main>

      <div className={styles.ScrollbarOverlay} onMouseDown={onTrackClick}>
        <div ref={trackRef} className={styles.ScrollbarTrack} />
        <div
          className={styles.ScrollbarThumb}
          style={{ top: thumbTop, height: thumbHeight }}
        />
      </div>

      <footer className={styles.MainFooter}>
        <MainFooter />
      </footer>

      <div className={styles.TVRemoteContainer}>
        <TVRemote
          isOpen={isRemoteOpen}
          onToggleRemote={() => setIsRemoteOpen((prev) => !prev)}
          onToggleFx={handleToggleFx}
        />
      </div>
    </div>
  );
}
