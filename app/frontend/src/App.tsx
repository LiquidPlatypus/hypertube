import "./styles/App.css";

import Header from "./components/layout/Header.tsx";
import PageFrame from "./components/layout/PageFrame.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import Footer from "./components/layout/Footer.tsx";

function App() {
	return (
		<main>
			<Header />
			<PageFrame>
				<LoginPage />
			</PageFrame>
			<Footer />
		</main>
	);
}

export default App;
