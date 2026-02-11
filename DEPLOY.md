# Деплой на Beget через GitLab

## Шаг 1: На вашем VPS (SSH)

```bash
# Логинитесь на сервер
ssh user@your-server-ip

# Клонируем repo
cd /home/user
git clone https://gitlab.com/your-username/megaplan-expenses.git
cd megaplan-expenses

# Создаем .env файл
cp .env.example .env
# Редактируем с вашими credentials:
nano .env

# Даем права на папку
chmod 755 .
```

## Шаг 2: В GitLab

1. Перейти в Settings → CI/CD → Variables
2. Добавить переменные:
   - `SSH_PRIVATE_KEY` - приватный SSH ключ сервера (в формате PEM, без паролей)
   - `SSH_USER` - пользователь на сервере (обычно `root` или ваше имя)
   - `SERVER_HOST` - IP адрес сервера

3. В Settings → CI/CD → Runners убедиться что есть active runner или использовать shared runners

## Шаг 3: Деплой

```bash
# На сервере, первый раз создаем контейнер вручную:
docker build -t megaplan-expenses .
docker run -d --name megaplan-expenses -p 3000:3000 --env-file .env megaplan-expenses

# После этого - просто push в main, и GitLab автоматически обновит
git add .
git commit -m "Deploy"
git push origin main
```

## Проверка

```bash
# На сервере:
curl http://localhost:3000/api/health

# В браузере:
http://your-server-ip:3000/?dealId=28994
```

## Обновления

После любого commit в `main` - автоматически:
1. Git pull
2. Docker rebuild
3. Контейнер перезапускается
