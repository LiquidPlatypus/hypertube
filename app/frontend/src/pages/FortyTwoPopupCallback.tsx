import { useEffect } from "react";

export default function FortyTwoPopupCallback() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const error_description = url.searchParams.get("error_description");

    window.opener?.postMessage(
      {
        type: "FT_OAUTH_RESULT",
        code,
        state,
        error,
        error_description,
      },
      window.location.origin
    );
    setTimeout(() => window.close(), 150);
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        margin: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "black",
        color: "white",
        fontSize: 16,
        fontFamily: "system-ui, sans-serif",
      }}
    >
      Connect to 42...
    </div>
  );
}