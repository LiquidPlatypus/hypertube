import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [newpassword, setNewpassword] = useState("");
    const [message, setMessage] = useState("");

    const forgotPasswordForm = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
			const token = localStorage.getItem("access_token");
			const response = await fetch("/api/reset-forgot-password", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ newpassword }),
			});
            if (!response.ok)
                throw new Error("Server error");
            const data: {returnValue: boolean} = await response.json();
            if (data.returnValue === true) {
                setMessage("Password Changed");
                navigate("/");
            }
        } catch (error) {
            console.error(error);
            setMessage("Error");
        }
    };

    return <div>
        {message && (
            <p>
                {message}
            </p>
        )}
        <form onSubmit={forgotPasswordForm}>
            <label htmlFor="new_password">New password: </label>
            <input
                type="text"
                name="new_password"
                id="new_password"
                value={newpassword}
                onChange={(e) => setNewpassword(e.target.value)}
                required
            />
            <button type="submit">Send new password</button>
        </form>
    </div>
}