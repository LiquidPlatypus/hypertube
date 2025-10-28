import * as React from "react";

import Header from "../components/Header.tsx"
import Footer from "../components/Footer.tsx"
import TVFrame from "../components/TVFrame.tsx"

interface MainLayoutProps {
	children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
	return (
		<div>
			<Header />
			<TVFrame>{ children }</TVFrame>
			<Footer />
		</div>
	)
}