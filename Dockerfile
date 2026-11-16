# --- сборка ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Параметры сборки: см. .env.example
ARG VITE_BASE=/
ARG VITE_API_URL=
ENV VITE_BASE=$VITE_BASE VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- раздача статики и прокси к бэкенду ---
FROM nginx:1.27-alpine
# Шаблон из /etc/nginx/templates образ nginx сам превращает в конфиг, подставляя переменные окружения
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/proxy.inc /etc/nginx/conf.d/proxy.inc
COPY --from=build /app/dist /usr/share/nginx/html
# Адрес бэкенда задаётся при запуске контейнера, образ пересобирать не нужно
ENV BACKEND_URL=http://host.docker.internal:8080
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
