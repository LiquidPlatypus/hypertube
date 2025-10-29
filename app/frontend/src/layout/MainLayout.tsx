import * as React from "react";

import Header from "../components/Header.tsx"
import Footer from "../components/Footer.tsx"

interface MainLayoutProps {
	children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
	return (
		<div className="flex flex-col min-h-screen items-center justify-between bg-[url('assets/backgrounds/fond.png')] bg-repeat bg-center">
			<Header />
				{children}
			<Footer />
		</div>
	)
}