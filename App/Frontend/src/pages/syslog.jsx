import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";

export default function Syslog() {
  const navigate = useNavigate();

  return (
    <div>
        <button>Login</button>
        <button>Register</button>
        <Outlet />
    </div>
  );
}

export function Login() {
  const navigate = useNavigate();

  return (
    <>
    </>
  );
}

export function Register() {
  const navigate = useNavigate();

  return (
    <>
    </>
  );
}
