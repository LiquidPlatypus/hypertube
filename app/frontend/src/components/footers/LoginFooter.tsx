import styles from "./LoginFooter.module.css";

interface LoginFooterProps {
  className?: string;
}

export default function LoginFooter({ className }: LoginFooterProps) {
  return (
    <footer className={`${styles.Footer} ${className || ""}`}>
      <div className={styles.Wrapper}>
        <h1 className={styles.Title}>Hypertube – Projet 42 – 2025</h1>
      </div>
    </footer>
  );
}
