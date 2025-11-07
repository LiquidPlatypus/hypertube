import { Outlet } from "react-router-dom";
import LoginLayout from "./layout/LoginLayout.tsx";

function App() {
	return (
		<div>
			<LoginLayout>
				<Outlet />
			</LoginLayout>
		</div>
	);
}

export default App;