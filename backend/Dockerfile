# syntax=docker/dockerfile:1
# ---------- builder: resolve and install dependencies into a virtualenv with uv ----------
FROM python:3.12-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /app
COPY requirements.txt .
RUN uv venv /opt/venv && VIRTUAL_ENV=/opt/venv uv pip install --no-cache -r requirements.txt

# ---------- runtime: slim image with only the venv and the app code ----------
FROM python:3.12-slim AS runtime
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
RUN useradd --create-home --uid 1000 fittrack
WORKDIR /app
COPY --from=builder /opt/venv /opt/venv
COPY --chown=fittrack:fittrack . .
RUN mkdir -p /app/data/uploads /app/data/exports && chown -R fittrack:fittrack /app/data
USER fittrack
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=4)" || exit 1
# Migrations + seeding run automatically on startup (see app/main.py).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
