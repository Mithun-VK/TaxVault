# syntax=docker/dockerfile:1
# Stage 1 - build the Vite bundle.
FROM node:22-alpine AS build

WORKDIR /app

# Install deps from the lockfile only, so the layer caches across source edits.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines VITE_* at build time, so they must be build args, not runtime env.
# The default is a relative path: nginx (stage 2) proxies /api to the API
# container, so the browser never needs to know the backend's address.
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_ENABLE_MOCKS=false
ARG VITE_APP_NAME=TaxVault
ARG VITE_APP_VERSION=3.0.0
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_ENABLE_MOCKS=$VITE_ENABLE_MOCKS \
    VITE_APP_NAME=$VITE_APP_NAME \
    VITE_APP_VERSION=$VITE_APP_VERSION

RUN npm run build


# Stage 2 - serve the static bundle and reverse-proxy the API.
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost/healthz || exit 1
