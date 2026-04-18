# Backend Dockerfile — production (Azure Container Apps)
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# CPU-only torch kept slim; extra-index-url in requirements.txt handles this
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download embedding model so cold starts don't hit HuggingFace
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
try: \
    SentenceTransformer('BAAI/bge-small-en-v1.5'); \
    print('bge-small-en-v1.5 cached'); \
except Exception as e: \
    print(f'bge fallback: {e}'); \
    SentenceTransformer('all-MiniLM-L6-v2'); \
    print('all-MiniLM-L6-v2 cached') \
"

COPY . .

RUN mkdir -p uploads attachments exports

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["gunicorn", "main:app", \
     "--workers", "2", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--access-logfile", "-"]
