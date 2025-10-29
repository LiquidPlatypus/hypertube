import React, {useState} from "react";
import {useNavigate} from "react-router-dom";
import Button from "../components/ui/Button.tsx";

export default function LoginScreen() {
	const navigate = useNavigate();
	const [isLogin, setIsLogin] = useState(true);
	const [message, setMessage] = useState("");

	// Login
	const [loginUsername, setLoginUsername] = useState("");
	const [loginPassword, setLoginPassword] = useState("");

	// Register
	const [registerFirstname, setRegisterFirstname] = useState("");
	const [registerLastname, setRegisterLastname] = useState("");
	const [registerUsername, setRegisterUsername] = useState("");
	const [registerEmail, setRegisterEmail] = useState("");
	const [registerPassword, setRegisterPassword] = useState("");
	const [registerPasswordConfirmation, setRegisterPasswordConfirmation] = useState("");

	// Login Handler
	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage("");

		try {
			const response = await fetch("/api/login", {
				method: "POST",
				headers: {"Content-Type": "application/json" },
				body: JSON.stringify({ username: loginUsername, password: loginPassword }),
			})
			if (!response.ok)
				throw new Error("Incorrect username or password");
			const data = await response.json();
			localStorage.setItem("access_token", data.access_token);
			navigate("/");
		} catch (error) {
			setMessage(error instanceof Error ? error.message : String(error));
		}
	};

	// Register handler
	const handleRegister = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage("");

		if (registerPassword !== registerPasswordConfirmation) {
			setMessage("Passwords doesn\'t match");
			return;
		}
		try {
			const response = await fetch("/api/register", {
				method: "POST",
				headers: {"Content-Type": "application/json" },
				body: JSON.stringify({
					username: registerUsername,
					password: registerPassword,
					email: registerEmail,
					firstname: registerFirstname,
					lastname: registerLastname,
				}),
			});
			if (!response.ok)
				throw new Error("Error during registration");
			const data = await response.json();
			if (data.returnValue === "ok") {
				setMessage("Account created successfully! You can now log in.");
				setTimeout(() => {
					setIsLogin(true);
					setMessage("");
				}, 2000);
			} else {
				setMessage(data.message || "Account creation not possible");
			}
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Error during registration");
		}
	};

	return (
		<div data-component="LoginScreen" className="flex flex-col items-center justify-center text-white bg-black/60 backdrop-blur-md p-6 rounded-lg shadow-lg">
			<h2 data-component="Login/Register" className="text-2xl font-bold mb-4">
				{isLogin ? "Login" : "Register"}
			</h2>

			{message && (
				<p className={`mb-4 text-center ${message.includes("create") ? "text-green-400" : "text-red-400"}`}>
					{message}
				</p>
			)}

			<div data-component="Buttons" className="flex gap-3 mb-4">
				<Button text="Login" size="medium" shape="pill" onClick={() => {setIsLogin(true); setMessage(""); }} />
				<Button text="Register" size="medium" shape="pill" onClick={() => {setIsLogin(false); setMessage(""); }} />
			</div>

			{isLogin? (
				<form data-component="LoginForm" className="flex flex-col gap-3 w-72" onSubmit={handleLogin}>
					<input type="text" placeholder="Username" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} className="p-2 rounded border-2 border-yellow-400 bg-black text-white focus:outline-none focus:border-yellow-500" required />
					<input type="password" placeholder="Password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="p-2 rounded border-2 border-yellow-400 bg-black text-white focus:outline-none focus:border-yellow-500" required />
					<Button text="Login" size="large" shape="pill" />
				</form>
			) : (
				<form data-component="RegisterForm" className="flex flex-col gap-3 w-72" onSubmit={handleRegister}>
					<input type="text" placeholder="First Name" value={registerFirstname} onChange={(e) => setRegisterFirstname(e.target.value)} className="p-2 rounded border-2 border-yellow-400 bg-black text-white focus:outline-none focus:border-yellow-500" required />
					<input type="text" placeholder="Last Name" value={registerLastname} onChange={(e) => setRegisterLastname(e.target.value)} className="p-2 rounded border-2 border-yellow-400 bg-black text-white focus:outline-none focus:border-yellow-500" required />
					<input type="text" placeholder="Username" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} className="p-2 rounded border-2 border-yellow-400 bg-black text-white focus:outline-none focus:border-yellow-500" required />
					<input type="email" placeholder="Email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} className="p-2 rounded border-2 border-yellow-400 bg-black text-white focus:outline-none focus:border-yellow-500" required />
					<input type="password" placeholder="Password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} className="p-2 rounded border-2 border-yellow-400 bg-black text-white focus:outline-none focus:border-yellow-500" required />
					<input type="password" placeholder="Confirm Password" value={registerPasswordConfirmation} onChange={(e) => setRegisterPasswordConfirmation(e.target.value)} className="p-2 rounded border-2 border-yellow-400 bg-black text-white focus:outline-none focus:border-yellow-500" required />
					<Button text="Register" size="large" shape="pill" />
				</form>
			)}
		</div>
	);
};