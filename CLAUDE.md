# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Megaplan Expenses Reporting Application** - A web application for displaying and exporting project expenses from Megaplan CRM. The app integrates with Megaplan's API to fetch deal information and associated expenses, displaying them in a 16-column table with CSV export functionality.

**Key Features:**
- Real-time expense data fetching from Megaplan
- 16-column expense table with automatic totaling
- CSV export with UTF-8 BOM (Excel compatibility)
- Responsive design with status indicators
- Integration with Megaplan's "External Source" field for embedding in deal cards

## Quick Start Commands

### Development
```bash
npm install          # Install dependencies
npm run dev          # Start server with auto-reload (requires nodemon)
npm start            # Start production server
```

### Configuration
1. Copy `.env.example` to `.env`
2. Update with your Megaplan credentials:
   ```env
   MEGAPLAN_ACCOUNT=your-account-name
   MEGAPLAN_LOGIN=api_user
   MEGAPLAN_PASSWORD=api_password
   ```
3. Update custom field IDs from your Megaplan instance (FIELD_STATUS, FIELD_CATEGORY, etc.)

### Testing
```bash
# Health check endpoint (after starting server)
curl http://localhost:3000/api/health

# Test with a specific deal ID
http://localhost:3000/?dealId=18899
```

## Architecture

### Layer Overview

```
┌─────────────────────────────────────────────────┐
│ Frontend (Browser)                              │
│ index.html → app.js → styles.css               │
└──────────────────┬──────────────────────────────┘
                   │ HTTP/JSON
                   ▼
┌─────────────────────────────────────────────────┐
│ Express Server (server.js)                      │
│ ├─ CORS middleware                             │
│ ├─ Static file serving                         │
│ ├─ GET /api/expenses → expenses.js             │
│ ├─ GET /api/export → export.js                 │
│ └─ GET /api/health (status check)              │
└──────────────────┬──────────────────────────────┘
                   │ HTTP Basic Auth
                   ▼
┌─────────────────────────────────────────────────┐
│ Megaplan API (https://account.megaplan.ru/api) │
│ ├─ GET /deal/{id} (fetch deal info)            │
│ └─ GET /task (fetch tasks for deal)            │
└─────────────────────────────────────────────────┘
```

### File Structure

| File | Purpose |
|------|---------|
| **server.js** | Express server, middleware setup, route registration |
| **index.html** | Single-page app structure with table skeleton |
| **js/app.js** | Frontend: data loading, table rendering, UI interactions |
| **css/styles.css** | Styling for table, status indicators, responsive layout |
| **api/expenses.js** | Backend: fetches deal info from Megaplan, maps tasks to expense objects |
| **api/export.js** | Backend: generates CSV with UTF-8 BOM, handles file download |
| **.env.example** | Template for environment configuration |

### Key Concepts

#### Data Flow: `/api/expenses?dealId=18899`
1. Request arrives with `dealId` query parameter
2. Fetch deal info from Megaplan: `GET /deal/{dealId}`
3. Fetch all tasks for the deal: `GET /task?deal={dealId}&limit=1000`
4. Map each task to expense object using custom field IDs
5. Calculate total from `finalCost` field
6. Return JSON with expenses array and metadata

#### Expense Object Structure
Each expense is mapped from a Megaplan task with fields:
```javascript
{
  deal_id, status, category, brand, contractor, paymentType,
  manager, amount, additionalCost, finalCost, fairCost,
  description, dealLink, creator, currency, deal_name
}
```

#### CSV Export
- Headers: 16 column names (bilingual: English ID + Russian label)
- Data rows: Expense values with proper escaping
- Total row: Sum of `finalCost` across all expenses
- **Critical**: Must include UTF-8 BOM (`\uFEFF`) at start for Excel compatibility

#### Custom Fields Mapping
Megaplan stores data in custom fields (not standard deal fields). The mapping is configured via environment variables:
- `FIELD_STATUS=1001` → status column
- `FIELD_CATEGORY=1002` → category column
- etc.

To find field IDs: Use Megaplan API Console → `GET /api/v3/task/{taskId}` → inspect `customFields` object.

#### Authentication
- Uses HTTP Basic Auth (base64 encoded username:password)
- Credentials come from `.env` variables: `MEGAPLAN_LOGIN` and `MEGAPLAN_PASSWORD`
- Header: `Authorization: Basic base64(login:password)`

### Frontend Integration

#### URL Parameters
The app expects `dealId` as a query parameter: `?dealId=18899`

#### Megaplan Embedding
To embed in a Megaplan deal card as "External Source" field:
1. Set field URL to: `https://your-domain.com/?dealId={{id}}`
2. Megaplan substitutes `{{id}}` with the current deal's ID

#### Status Rendering
Status values receive color-coded badges:
- "Оплачено" → Green
- "Запланировано" → Blue
- "В обработке" → Orange
- Other → Gray

### Common Development Tasks

#### Adding a New Expense Column
1. Add field ID to `CUSTOM_FIELDS` in `api/expenses.js` and `api/export.js`
2. Update `.env.example` with the new field ID
3. Map the field in `mapExpense()` function (both API files)
4. Update table headers in `index.html`
5. Add render logic in `app.js` `renderTable()` function
6. Update CSV headers and row generation in `export.js`

#### Filtering Expenses
Currently all tasks are included. To filter (e.g., only expense tasks):
- Modify the `.filter()` in `api/expenses.js` line 143
- Apply same logic to `api/export.js` line 221

#### Deployment Considerations
- **Vercel/Netlify**: Requires serverless function setup (currently using Express)
- **VPS/Self-hosted**: Use PM2 or systemd for process management
- **Environment variables**: Set MEGAPLAN_* credentials securely in hosting platform

### Potential Issues & Solutions

**"Deal not found"** → Check dealId is valid and API user has access
**CSV shows gibberish** → Verify UTF-8 BOM is present (critical for Excel)
**CORS errors** → Verify CORS middleware in `server.js` (currently allows all origins)
**Unauthorized** → Check Megaplan credentials in `.env` and API user permissions
**Slow loading** → Increase task limit (line 135/215) or implement pagination

## Tech Stack

- **Runtime**: Node.js 16+
- **Server**: Express 4.18+
- **HTTP Client**: Axios 1.6+
- **CORS**: cors 2.8+
- **Environment**: dotenv 16.3+
- **Dev**: nodemon 3.0+
