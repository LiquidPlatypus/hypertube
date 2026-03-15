FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y build-essential python3-dev \
    libtorrent-rasterbar-dev libboost-python-dev libboost-system-dev ffmpeg


COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ./app .

EXPOSE 8000

#TODO enlever le --reload pour la prod
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]