from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

# INIT

app = FastAPI()

frontend_dir = os.path.join(os.path.dirname(__file__), "../../Frontend/dist")
app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dir, "assets")), name="assets")

# CODE

@app.get("/")
def read_root():
    index_path = os.path.join(frontend_dir, "index.html")
    return FileResponse(index_path)
