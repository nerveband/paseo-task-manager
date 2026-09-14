# External Task Source Specification

Task Manager supports an optional read-only external task source. When configured in settings, the plugin queries an HTTP or HTTPS endpoint to display external tasks alongside local board tasks.

## Design Constraints

1. External sources are strictly opt-in. By default, no remote source is configured, and no network requests are made.
2. There is no fallback URL and no default endpoint. If a configured source fails, the plugin reports a warning in the board state and continues displaying local tasks.
3. Credentials inside URLs are rejected. Authentication headers are not forwarded.
4. Source tasks never overwrite local tasks. If an external record ID collides with a local task ID, the local task takes precedence.

## Endpoint Contract

The configured URL must accept HTTP GET requests with query parameters:

```http
GET <url>?limit=100[&cursor=<token>]
```

### Query Parameters

| Parameter | Type | Description |
|:--|:--|:--|
| `limit` | integer | Maximum number of records per page (default: 100, maximum: 100). |
| `cursor` | string (optional) | Opaque pagination cursor returned by the previous page. |

### Response Schema

The endpoint must return a JSON object with `records` and optional `nextCursor`:

```json
{
  "records": [
    {
      "id": "tsk_external_001",
      "title": "Configure automated database schema verification probes",
      "category": "Backend",
      "stage": "Todo",
      "project": "Sample Project Alpha",
      "owner": "Alex Rivera",
      "due": "2026-09-20",
      "spec": "Run validation checks before schema migration",
      "notes": "Ensure zero-downtime compatibility",
      "link": "https://example.com/spec/123",
      "priority": 1,
      "sort": 1,
      "archived": false,
      "prominent": true
    }
  ],
  "nextCursor": null
}
```

### Record Fields

| Field | Type | Required | Description |
|:--|:--|:--|:--|
| `id` | string | Yes | Unique task identifier. Missing or blank IDs cause the record to be dropped. |
| `title` | string | Yes | Task title. Missing or blank titles cause the record to be dropped. |
| `category` | string | No | Category pill text (default: "General"). |
| `stage` | string | No | Stage name. If not matching any configured board stage, the task is placed in the first stage. |
| `project` | string | No | Project name. Matched case-insensitively against existing projects. If unmapped, the task is assigned to the configured fallback project. |
| `owner` | string | No | Assignee name or identifier. |
| `due` | string | No | Due date in ISO or YYYY-MM-DD format. |
| `spec` | string | No | Specification or acceptance criteria text. |
| `notes` | string | No | Context notes or instructions. |
| `link` | string | No | Reference link (must use http: or https: scheme). |
| `priority` | integer | No | Priority level: 0 (urgent), 1 (high), 2 (medium), or 3 (low). Defaults to 2. |
| `sort` | number | No | Display sorting order within the column. |
| `archived` | boolean | No | Whether the record is archived (default: false). |
| `prominent` | boolean | No | Whether the card displays a prominent accent border (default: false). |

## Error Handling

- HTTP status codes other than 200 return a user-visible warning.
- Network timeouts occur after 10 seconds per request.
- Pagination terminates after 10 consecutive pages or 1,000 total records to prevent memory exhaustion.
