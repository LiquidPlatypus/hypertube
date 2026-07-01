import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function IdentifyForReset() {
    const navigate = useNavigate();
    const { token } = useParams<{ token: string }>();

    useEffect(() => {
        const verifyToken = async () => {
            console.log(token);

            try {
                const response = await fetch(`/api/forgot-password`, {
                    method: "POST",
                    headers: {
    					"Content-Type": "application/json",
					    Authorization: `Bearer ${token}`,
                    },
                });
                if (!response.ok) {
                    throw new Error("Invalid Token");
                }
                const data: {returnValue: Boolean} = await response.json();
                console.log(data.returnValue);
                if (token)
                    localStorage.setItem("access_token", token);
                else
                    throw new Error("Corrupt Token");
                navigate('/forgot-password');
            } catch (error) {
                console.error(error);
                navigate('/auth/login');
            }
        };
        verifyToken();
    }, [navigate]);

    return <h2>We try to identify you</h2>
}