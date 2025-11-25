import styles from "./LoginHeader.module.css";

interface LoginHeaderProps {
  className?: string;
}

export default function LoginHeader({ className }: LoginHeaderProps) {
  return (
    <header className={`${styles.Header} ${className || ""}`}>
      <div className={styles.Wrapper}>
        <h1 className={styles.Title}>RetroTube TV</h1>
      </div>
    </header>
  );
}
