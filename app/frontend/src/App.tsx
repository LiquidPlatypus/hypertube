import { Outlet } from "react-router-dom";
import MainLayout from "./layout/MainLayout.tsx";

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