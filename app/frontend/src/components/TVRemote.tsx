import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { createPortal } from "react-dom";

import Button from "./ui/Button.tsx";
import SearchBar from "./ui/SearchBar.tsx";
import { useTranslation } from "../hooks/useTranslation.tsx";

import styles from "./TVRemote.module.css";

export default function TVRemote() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showSearch, setShowSearch] = useState(false);
  const { currentLang, changeLang } = useTranslation();

  const closeSearch = () => setShowSearch(false);

  const goHome = () => {
    closeSearch();
    navigate("/");
  };

  const showSearchBar = () => {
    // Bloque la searchbar sur la page profil
    if (location.pathname === "/profile") return;
    setShowSearch((prev) => !prev); // toggle
  };

  const goToProfile = () => {
    closeSearch();
    navigate("/profile");
  };

  const handleChangeLang = async () => {
    const newLang = currentLang === "en" ? "fr" : "en";
    await changeLang(newLang);
  };

  const handleLogout = () => {
    closeSearch();
    localStorage.removeItem("access_token");
    localStorage.setItem("just_logged_out", "true");

    const overlay = document.createElement("div");
    overlay.className = styles.LogoutOverlay;
    document.body.appendChild(overlay);

    setTimeout(() => {
      document.body.removeChild(overlay);
      navigate("/auth/login");
    }, 1500);
  };

  return (
    <div className={styles.TVRemote}>
      <Button
        size="small"
        shape="square"
        icon="assets/HomeW.svg"
        className={styles.HomeBtn}
        variant="remote"
        onClick={goHome}
      />
      <Button
        size="small"
        shape="square"
        icon="assets/SearchW.svg"
        className={styles.SearchBtn}
        variant="remote"
        onClick={showSearchBar}
      />
      <Button
        size="small"
        shape="square"
        icon="assets/Profil.png"
        className={styles.ProfileBtn}
        variant="remote"
        onClick={goToProfile}
      />
      <Button
        text="EN/FR"
        size="small"
        shape="square"
        className={styles.LangBtn}
        variant="remote"
        onClick={handleChangeLang}
      />
      <Button
        size="small"
        shape="square"
        icon="assets/LogoutW.svg"
        className={styles.LogoutBtn}
        variant="remote"
        onClick={handleLogout}
      />
		{showSearch &&
			createPortal(
				<div className={styles.SearchOverlayRoot}>
				<SearchBar closeSearch={closeSearch} currentLang={currentLang} />
				</div>,
				document.getElementById("search-overlay-root")!
		)}
    </div>
  );
}
