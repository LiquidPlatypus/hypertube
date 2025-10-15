import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
		<div style={{ textAlign: 'center', marginTop: '20%' }}>
			<h1>HyperTube !</h1>
		</div>
    </>
  )
}

export default App
