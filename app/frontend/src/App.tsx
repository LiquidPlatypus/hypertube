import MainLayout from "./layout/MainLayout.tsx";
import { Outlet } from "react-router-dom";

function App() {
	return (
		<div>
			<MainLayout>
				<Outlet />
			</MainLayout>
		</div>
	);
}

export default App;