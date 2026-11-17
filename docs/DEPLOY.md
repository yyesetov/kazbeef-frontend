# Развёртывание KazBeef на сервере (Ubuntu / Debian)

Интерфейс и API работают на одном сервере и открываются по одному адресу:

```
Браузер ──► https://kazbeef.example.kz
              │
              Caddy (HTTPS, порты 80/443)          ← папка ~/kazbeef-frontend
              │
              frontend: nginx — страницы интерфейса,
              │         /api, /admin, /public → бэкенд
              │
              app:8080 ──► db                       ← папка ~/kazbeef (бэкенд)
```

- Один адрес для интерфейса и API: CORS не нужен, cookie входа «свои» для браузера, вход работает и в Safari.
- HTTPS-сертификат Caddy получает и продлевает сам (Let's Encrypt).
- Наружу открыты только порты 80 и 443. Бэкенд и база из интернета не видны.
- Свой домен не обязателен: `sslip.io` превращает IP в имя (`203-0-113-10.sslip.io` → `203.0.113.10`).
  Когда появится домен, достаточно поменять `SITE_HOST`.

Ниже `203.0.113.10` — пример IP, `kazbeef.example.kz` — пример адреса. Подставляйте свои.

Порядок важен: **сначала бэкенд, потом интерфейс**. Интерфейс подключается к Docker-сети бэкенда, и пока
её нет, он не запустится.

> **На сервере уже работают другие проекты?** Сначала шаг 0. Всё, что создают команды ниже, получает приставки
> `kazbeef` и `kazbeef-frontend` и чужие контейнеры не трогает. Задеть другие проекты могут только включение
> файрвола `ufw` и запуск Caddy на уже занятых портах 80/443.

---

## 0. Что уже занято на сервере

```bash
sudo ss -tlnp | grep -E ':(80|443|3000|18080) '
sudo ufw status
docker ps --format '{{.Names}}  {{.Ports}}'
```

| Что видно                                     | Как действовать                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| Порты 80 и 443 свободны                       | основной путь: шаги 1–6                                                             |
| 80/443 заняты nginx, Apache или другим прокси | **вариант Б** (раздел ниже): Caddy не запускается, сайт добавляется в ваш nginx     |
| `ufw status` — `inactive`                     | **не включайте** `ufw`: это закроет порты других проектов; команды `ufw` пропустите |
| `ufw status` — `active`                       | только добавьте разрешения (`ufw allow …`), `ufw enable` не нужен                   |
| Docker уже установлен                         | установку Docker в шаге 1 пропустите                                                |

## 1. Подготовка сервера

Подключитесь по SSH и установите Docker:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
sudo systemctl enable docker
```

Выйдите из SSH и зайдите снова, чтобы группа `docker` применилась. Проверка (нужна версия 2.24 или новее):

```bash
docker compose version
```

Порты — **только если `ufw` уже включён** (`sudo ufw status` → `active`):

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
```

Если сервер у облачного провайдера, откройте 80 и 443 и в его панели (security group / firewall).

Адрес сайта:

- **есть домен** — создайте у регистратора запись `A`: `kazbeef.example.kz` → IP сервера;
- **домена нет** — узнайте IP (`curl -4 ifconfig.me`) и используйте `203-0-113-10.sslip.io` (IP через дефисы).

## 2. Бэкенд

```bash
git clone https://github.com/yyesetov/kazbeef-backend.git ~/kazbeef
cd ~/kazbeef
cp .env.example .env
nano .env
```

> Папка должна называться `kazbeef`: от имени папки зависит имя Docker-сети (`kazbeef_default`), к которой
> подключается интерфейс. Если назвали иначе — см. `BACKEND_NETWORK` в шаге 3.

Заполните `.env`:

```env
DB_PASSWORD=<длинный случайный пароль>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<пароль для входа в интерфейс>
KAZBEEF_CONTACT_EMAIL=<ваш e-mail>

# адрес сайта: ссылки в оповещениях ведут сюда
KAZBEEF_PUBLIC_URL=https://kazbeef.example.kz

# бэкенд без своего HTTPS: его закрывает интерфейс, наружу он не публикуется
COMPOSE_FILE=docker-compose.yml:deploy/docker-compose.behind-proxy.yml
APP_PORT=18080

# необязательно: ИИ (перевод, резюме, чат по базе знаний)
ANTHROPIC_API_KEY=sk-ant-...
# необязательно: оповещения в Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

`API_HOST` и `KAZBEEF_CORS_ORIGINS` в этой схеме не нужны: интерфейс и API на одном адресе.
Случайный пароль: `openssl rand -base64 24`.

```bash
chmod 600 .env
docker compose up -d --build
```

Первая сборка — 3–5 минут. Проверка (порт 18080 открыт только для самого сервера):

```bash
docker compose ps
curl http://127.0.0.1:18080/actuator/health      # → {"status":"UP"}
```

## 3. Интерфейс

```bash
git clone <адрес репозитория интерфейса> ~/kazbeef-frontend
cd ~/kazbeef-frontend
nano .env
```

Содержимое `.env`:

```env
COMPOSE_FILE=docker-compose.yml:deploy/docker-compose.server.yml
# адрес сайта без https:// — для него Caddy получит сертификат
SITE_HOST=kazbeef.example.kz
# только если папка бэкенда называется не kazbeef: имя сети из `docker network ls`
# BACKEND_NETWORK=kazbeef_default
```

Запуск:

```bash
docker compose up -d --build
```

Поднимутся два контейнера: `frontend` (страницы и прокси к API) и `caddy` (HTTPS). Сборка — 1–2 минуты.

## 4. Проверка

```bash
docker compose ps
curl https://kazbeef.example.kz/healthz                 # → ok
curl https://kazbeef.example.kz/public/chat/status      # → {"enabled":true,...}
```

Первый запрос может занять до минуты: Caddy получает сертификат. Затем в браузере:

- `https://kazbeef.example.kz` — форма входа, после входа — дашборды;
- `https://kazbeef.example.kz/chat` — чат без входа (эту ссылку можно давать посетителям).

## 5. Первая загрузка данных

Войдите → **Управление → Источники** → «Собрать данные» у WAHIS, ИАЦ и EFSA. Или дождитесь ночного запуска.

## 6. Автозапуск

Контейнеры перезапускаются сами после сбоя и после перезагрузки сервера (`restart: unless-stopped`), если служба
Docker включена (`sudo systemctl enable docker`, шаг 1).

---

## Вариант Б: на сервере уже есть nginx с другими сайтами

Caddy не запускается, интерфейс слушает только `127.0.0.1:3000`, HTTPS делает ваш nginx — отдельным сайтом.

1. Бэкенд — шаг 2 без изменений.
2. Интерфейс — шаг 3, но в `.env`:

   ```env
   COMPOSE_FILE=docker-compose.yml:deploy/docker-compose.behind-proxy.yml
   # свободный локальный порт; проверка: sudo ss -tlnp | grep ':3000 ' ничего не выводит
   FRONTEND_PORT=3000
   ```

   `docker compose up -d --build`, проверка: `curl http://127.0.0.1:3000/healthz` → `ok`.

3. Сайт в nginx — готовый файл `deploy/nginx-site.conf`. Замените в нём адрес и порт, затем:

   ```bash
   sudo cp deploy/nginx-site.conf /etc/nginx/sites-available/kazbeef
   sudo ln -s /etc/nginx/sites-available/kazbeef /etc/nginx/sites-enabled/kazbeef
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d kazbeef.example.kz
   ```

   `nginx -t` проверяет конфигурацию до применения: при ошибке `reload` не выполнится, и другие сайты продолжат
   работать. `certbot` (пакет `python3-certbot-nginx`) правит только файл `kazbeef`.

   **Другой веб-сервер** (Apache, Traefik…): проксируйте адрес сайта на `http://127.0.0.1:3000`, передавайте
   заголовки `Host` и `X-Forwarded-Proto`, для `/public/` отключите буферизацию ответа, разрешите тело запроса
   до 200 МБ.

---

## Обновление

| Что обновить | Команды                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Интерфейс    | `cd ~/kazbeef-frontend && git pull && docker compose up -d --build`                                                              |
| Бэкенд       | `cd ~/kazbeef && git pull && docker compose up -d --build`, **затем** `cd ~/kazbeef-frontend && docker compose restart frontend` |
| Настройки    | поправить `.env` и `docker compose up -d` в той же папке                                                                         |

Почему после бэкенда перезапускается интерфейс: nginx запоминает адрес контейнера `app` при старте, а пересобранный
контейнер получает новый. Без перезапуска сайт отвечает `502 Bad Gateway`.

Логи: `docker compose logs -f` в папке нужного проекта (`app` — бэкенд, `frontend`, `caddy`).

Резервные копии базы и документов базы знаний — раздел «Обслуживание» в `DEPLOY.md` бэкенда.

---

## Если не работает

| Признак                                                                          | Причина и что делать                                                                                               |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `network kazbeef_default declared as external, but could not be found`           | бэкенд не запущен или его папка называется иначе: `docker network ls`, имя сети — в `BACKEND_NETWORK`              |
| Контейнер `frontend` перезапускается, в логах `host not found in upstream "app"` | бэкенд не запущен: `cd ~/kazbeef && docker compose up -d`                                                          |
| `502 Bad Gateway`                                                                | бэкенд пересобран, а интерфейс нет: `docker compose restart frontend`                                              |
| Сайт не открывается по `https://`                                                | закрыты порты 80/443 у провайдера или в `ufw`; `docker compose logs caddy`                                         |
| Caddy пишет об ошибке сертификата                                                | порт 80 должен быть открыт (Let's Encrypt проверяет сервер через него); запись `A` должна указывать на этот сервер |
| `ports: !reset` — ошибка разбора файла                                           | старый Docker Compose: нужна версия 2.24+, обновите Docker                                                         |
| Чат пишет «Чат не настроен»                                                      | не задан `ANTHROPIC_API_KEY` в `.env` бэкенда; после правки — `docker compose up -d` в `~/kazbeef`                 |
| Ответ чата приходит одним куском                                                 | между браузером и сервером есть ещё прокси с буферизацией (вариант Б: проверьте блок `/public/` в nginx)           |
| Загрузка документа — ошибка 413                                                  | вариант Б: в сайте nginx нет `client_max_body_size 200m`                                                           |

---

## Другая схема: интерфейс на Cloudflare Workers

`DEPLOY.md` бэкенда описывает схему, где интерфейс собирается в Cloudflare с `VITE_API_URL`, а API открыт
отдельным адресом с CORS. Она тоже рабочая, но cookie входа там «сторонние»: Safari и Firefox со строгой защитой
могут их блокировать, и вход не сработает. Схема из этого документа такой проблемы не имеет. Если всё же нужен
Cloudflare — следуйте `DEPLOY.md` бэкенда; этот документ тогда не нужен.
