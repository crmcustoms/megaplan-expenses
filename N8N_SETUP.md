# н8н Setup для Megaplan Expenses

## Готовые Workflows

1. **n8n-workflow-expenses-data.json** - Sub-workflow для получения данных
2. **n8n-workflow-expenses-json.json** - API /api/expenses
3. **n8n-workflow-expenses-csv.json** - API /api/export
4. **n8n-workflow-expenses-ui.json** - HTML интерфейс /expenses

## Импорт Workflows

1. В н8н меню → "Import from File"
2. Выбрать каждый JSON файл по порядку
3. Для каждого workflow: Edit → Save

## Настройка Environment Variables

В н8н Settings → Environment variables добавить:

```
MEGAPLAN_BEARER_TOKEN=NzZkODNiOGUwMWNlMGIyMTY5NzlkMDkzOGEzOWFlOGI1MGYyNTk0YThmOWJkYWE5ZDFlMGMyNGU2YWQ2ZWI1ZA
MEGAPLAN_EXPENSES_DATA_WORKFLOW_ID={{id_of_first_workflow}}
```

Где `{{id_of_first_workflow}}` - это ID workflow'а "Megaplan Get Expenses Data" (видно в URL при открытии)

## Запуск

После импорта всех workflows:

1. Открыть каждый workflow и нажать "Activate"
2. Перейти на http://your-n8n-instance/webhook/expenses?dealId=28994

## Endpoints

- `GET /webhook/expenses?dealId=28994` - HTML интерфейс
- `GET /webhook/api/expenses?dealId=28994` - JSON API
- `GET /webhook/api/export?dealId=28994` - CSV экспорт

## Bearer Token

Заменить везде в workflows на ваш токен из .env:
```
NzZkODNiOGUwMWNlMGIyMTY5NzlkMDkzOGEzOWFlOGI1MGYyNTk0YThmOWJkYWE5ZDFlMGMyNGU2YWQ2ZWI1ZA
```
