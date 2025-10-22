# Hypertube
Hypertube project for 42 School


## Init new front :

1) Replace the contents of the frontend folder in the app/ for your React project
2) python -v venv venv (la suite dans le venv)
3) pip install -r requirements.txt
    In app/frontend
4) add in vite.config.js :
```
export default defineConfig({
  plugins: [react()],
  server: {
	port: 5173,
	proxy: {
		'/api': {
			target: 'http://127.0.0.1:8000',
			changeOrigin: true,
			rewrite: (path) => path.replace(/^\/api/, '')
		},
	},
  },
})
```
5) add in src/App.jsx : (OPTIONAL)
```
  useEffect(() => {
    const socket = new WebSocket("ws://127.0.0.1:8000/ws");

    socket.onopen = () => {
      console.log("Connecté !");
      socket.send("Salut du front !");
    };
    socket.onmessage = (event) => console.log("Serveur:", event.data);
    return () => socket.close();
  }, []);
```
6) npm install

and there it is init now to launch the dev server you just have to execute the python script "run_dev.py".
