FROM node:22-alpine AS frontend-build

WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


FROM python:3.12-slim AS runtime

WORKDIR /workspace/backend

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/.env.production.example ./.env.production.example
COPY --from=frontend-build /workspace/dist ../dist
COPY --from=frontend-build /workspace/frontend ../frontend

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
