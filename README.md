# Megaplan Expenses Reporting Application

Веб-приложение для отображения и экспорта расходов проектов из Megaplan CRM с интеграцией для встраивания в карточки сделок.

## 🚀 Быстрый старт

### Развертывание
```bash
# 1. Клонируем репозиторий
git clone https://github.com/crmcustoms/megaplan-expenses.git
cd megaplan-expenses

# 2. Копируем .env файл
cp .env.example .env

# 3. Обновляем переменные окружения
# MEGAPLAN_ACCOUNT=your-account
# MEGAPLAN_BEARER_TOKEN=your-token
# FIELD_STATUS=1001

# 4. Запускаем контейнер
docker-compose up -d

# 5. Приложение доступно на http://localhost:3001
```

## 📍 URL для использования

### В браузере (с таблицей расходов)
```
https://directus.2l-pr.com/?dealId={Id сделки}
```

### Для встраивания в Megaplan
Используйте как "External Source" поле в карточке сделки:
```
https://directus.2l-pr.com/?dealId={{id}}
```
Megaplan автоматически заменит {{id}} на ID текущей сделки

---

## 🔌 API Endpoints

### 1. Получить расходы (с таблицей)
```
GET https://directus.2l-pr.com/api/expenses?dealId=28744
```

**Параметры:**
- `dealId` (обязательный) - ID сделки в Megaplan

**Ответ:** HTML страница с таблицей расходов

**Пример:**
```bash
curl "https://directus.2l-pr.com/api/expenses?dealId=28744"
```

---

### 2. Синхронизация расходов (без UI)
```
GET https://directus.2l-pr.com/api/sync-expenses?dealId=28744
```

**Параметры:**
- `dealId` (обязательный) - ID сделки в Megaplan

**Ответ:** JSON с результатом синхронизации

**Пример ответа:**
```json
{
  "dealId": "28744",
  "dealName": "Название проекта",
  "expensesCount": 6,
  "totalAmount": 144771.77,
  "updated": true,
  "message": "Expenses synced successfully"
}
```

**Использование:**
```bash
# В браузере
https://directus.2l-pr.com/api/sync-expenses?dealId=28744

# Через curl
curl "https://directus.2l-pr.com/api/sync-expenses?dealId=28744"

# Через JavaScript fetch
fetch('https://directus.2l-pr.com/api/sync-expenses?dealId=28744')
  .then(r => r.json())
  .then(data => console.log(data))
```

**Идеально для:**
- n8n автоматизации
- Webhook триггеров
- Cron задач
- Программного обновления расходов без UI

---

### 3. Экспорт в Excel
```
GET https://directus.2l-pr.com/api/export?dealId=28744
```

**Параметры:**
- `dealId` (обязательный) - ID сделки в Megaplan

**Ответ:** Excel файл (XLSX)

**Пример:**
```bash
curl "https://directus.2l-pr.com/api/export?dealId=28744" -o expenses.xlsx
```

**Содержимое Excel:**
- 15 колонок с данными расходов
- Итоговая строка с суммой финальной стоимости
- UTF-8 кодировка для корректного отображения кириллицы

---

### 4. Обновление поля в основной сделке
```
POST https://directus.2l-pr.com/api/update-deal-field
```

**Параметры (JSON body):**
```json
{
  "dealId": "28744",
  "fieldValue": 144771.77
}
```

**Ответ:**
```json
{
  "status": 200,
  "dealId": "28744",
  "fieldValue": 144771.77
}
```

---

### 5. Health Check
```
GET https://directus.2l-pr.com/api/health
```

**Ответ:** Статус приложения и время последнего деплоя

---

## 📊 Структура таблицы расходов

Таблица содержит 15 колонок с полной информацией о расходах:
- Статус платежа
- Категория расхода
- Бренд/поставщик
- Контрагент
- Тип платежа
- Суммы (базовая, доп. расходы, финальная)
- Справедливая цена
- Валюта
- Описание
- Название и менеджер сделки
- Автор записи

---

## ⚙️ Конфигурация

### Переменные окружения (.env)

```env
# Megaplan Credentials
MEGAPLAN_ACCOUNT=your-account-name
MEGAPLAN_BEARER_TOKEN=your-bearer-token
MEGAPLAN_API_URL=https://your-account.megaplan.ru/api/v3

# Custom Fields IDs
FIELD_STATUS=1001
FIELD_CATEGORY=1002
FIELD_BRAND=1003
FIELD_CONTRACTOR=1004
FIELD_PAYMENT_TYPE=1005
FIELD_AMOUNT=1006
FIELD_ADDITIONAL_COST=1007
FIELD_FINAL_COST=1008
FIELD_FAIR_COST=1009
FIELD_CURRENCY=1010

# GitHub Webhook
GITHUB_WEBHOOK_SECRET=your-webhook-secret
```

---

## 🔄 GitHub Auto-Deployment

Приложение автоматически деплоится при push в main ветку:

1. GitHub webhook → POST /api/deploy
2. Сервер выполняет git pull
3. Docker пересобирает образ
4. Контейнер перезагружается
5. **Результат:** обновление за 20-25 секунд

### Настройка webhook

Репозиторий Settings → Webhooks → Add webhook:
- **URL:** https://directus.2l-pr.com/api/deploy
- **Content type:** application/json
- **Secret:** (используйте GITHUB_WEBHOOK_SECRET из .env)
- **Events:** Push events

---

## 🐳 Docker

```bash
# Запустить контейнер
docker-compose up -d

# Остановить контейнер
docker-compose down

# Пересоздать (новая сборка)
docker-compose up --build -d

# Логи
docker-compose logs -f megaplan-expenses

# Перезагрузить
docker-compose restart megaplan-expenses
```

**Контейнер:** Node.js 18 Alpine, порт 3001:3000, auto-restart enabled

---

## 📝 Примеры использования

### Встраивание в Megaplan
```
https://directus.2l-pr.com/?dealId={{id}}
```

### n8n автоматизация
```
GET https://directus.2l-pr.com/api/sync-expenses?dealId={{dealId}}
```

### Экспорт через curl
```bash
curl "https://directus.2l-pr.com/api/export?dealId=28744" -o expenses.xlsx
```

### JavaScript
```javascript
fetch('https://directus.2l-pr.com/api/sync-expenses?dealId=28744')
  .then(r => r.json())
  .then(data => console.log(`Сумма: ${data.totalAmount}`))
```

---

## ✅ Функциональность

- Загрузка расходов из связанных сделок Megaplan
- Таблица с 15 колонками данных
- Экспорт в Excel
- API для программного доступа
- Auto-deployment через GitHub
- Health checks
- Поддержка UTF-8 (кириллица)
- Дизайн система Supabase с OKLCH цветами

---

## 📞 Контакты

- **Репозиторий:** https://github.com/crmcustoms/megaplan-expenses
- **Сервер:** 155.212.187.93:3001
- **Домен:** https://directus.2l-pr.com

---

**Последнее обновление:** 2026-02-12
**Версия:** 1.0.0
