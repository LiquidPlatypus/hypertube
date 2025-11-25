import { useEffect, useState } from "react";
import styles from "./TvBootScreen.module.css";

interface TvBootEffectProps {
  onComplete: () => void;
}

export default function TvBootScreen({ onComplete }: TvBootEffectProps) {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setStarted(true);
    const timer = setTimeout(() => {
      onComplete();
    }, 1800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className={`${styles.overlay} ${started ? styles.active : ""}`}>
      <div className={styles.flashLine}></div>
      <div className={styles.staticNoise}></div>
    </div>
  );
}
