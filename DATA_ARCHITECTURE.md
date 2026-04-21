# Chatbot Project — Data Architecture Analysis

## Executive Summary

The **chatbot** project is a **Next.js AI assistant service** focused on conversation management and delivery, NOT a data content repository. It does **not manage spaces, PDF/JSON data, scenes, or characters** — those are handled by the main **movieshakerv2** project.

The chatbot's primary responsibilities are:
- **Chat conversation persistence** (store message history per client/session)
- **Mode-based system prompts** (context-aware responses for different production tasks)
- **Gateway integration** (communicate with openrouter-gateway for LLM calls)
- **Session management** (track users by client ID or email)

---

## 1. Core Architecture Overview

### Framework & Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: JavaScript (Node.js backend, React frontend)
- **Styling**: Tailwind CSS
- **Database Support**: PostgreSQL or Azure SQL Server
- **External Gateway**: `https://models.rapidmvp.io` (openrouter-gateway)
- **Deployment**: HTTPS at `https://chatbot.rapidmvp.io`

### Project Structure
```
chatbot/
├── app/
│   ├── api/
│   │   ├── chat/route.js                 ← Main chat endpoint (POST)
│   │   ├── chat-modes/route.js           ← List available modes (GET)
│   │   └── health/route.js               ← Health check (GET)
│   ├── chatbot/
│   │   ├── page.js                       ← Full app entry
│   │   ├── [modeId]/page.js              ← Mode-specific view
│   │   └── embed/                        ← Embedded widget routes
│   └── layout.js
├── components/chatbot/
│   ├── ChatbotClient.jsx                 ← Main UI shell
│   ├── Chat.jsx                          ← Message interface
│   └── utils/
│       ├── api.js                        ← API endpoint builder
│       ├── cookies.js                    ← Email persistence
│       └── formatChatContent.js          ← Markdown formatting
├── lib/server/
│   ├── modes.js                          ← Chat mode definitions (SINGLE SOURCE OF TRUTH)
│   ├── prompt.js                         ← Message array builder
│   ├── gateway-client.js                 ← Gateway integration
│   ├── session.js                        ← Session utilities
│   ├── env.js                            ← Environment config
│   ├── cors.js                           ← CORS handling
│   ├── http.js                           ← Safe JSON parsing
│   └── persistence/
│       ├── index.js                      ← No-op shim (retired)
│       ├── db-pg.js                      ← PostgreSQL adapter
│       └── db-azure.js                   ← Azure SQL adapter
└── middleware.js                         ← CSP frame-ancestors header
```

---

## 2. Data Model Architecture

### NOT Managed by Chatbot
The following data models are **NOT** managed by the chatbot:
- **Spaces Object** (DigitalOcean Spaces / S3 for file storage)
- **PDF/JSON Data** (script files)
- **Scenes** (scene headings, page numbers, length in eighths)
- **Characters** (parsed from scripts, with casting notes, images)
- **Projects** (production projects)
- **Budgets** (production budgets)

These are all managed by the **movieshakerv2 engine** project.

### Managed by Chatbot: Conversation & Session Data

#### 1. **Chat Session** (`chat_sessions` table)
Stores user session information.

```sql
CREATE TABLE chat_sessions (
  client_id VARCHAR(256) NOT NULL PRIMARY KEY,
  email VARCHAR(320) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

**Fields:**
- `client_id`: Unique session identifier (UUID or IP hash, max 256 chars)
- `email`: Optional email for user identification (max 320 chars)
- `created_at`: Session creation timestamp
- `updated_at`: Last activity timestamp

**Purpose:**
- Track user sessions (can be based on session_id param or IP hash)
- Link multiple conversations to same user (via email)
- Support email-based lookups for conversation history

---

#### 2. **Chat Messages** (`chat_messages` table)
Stores individual chat messages across conversations.

```sql
CREATE TABLE chat_messages (
  id BIGSERIAL PRIMARY KEY,
  client_id VARCHAR(256) NOT NULL,
  conversation_id VARCHAR(64) NOT NULL,
  chat_mode VARCHAR(64) NOT NULL,
  role VARCHAR(32) NOT NULL,
  content TEXT NOT NULL,
  model VARCHAR(128) NULL,
  usage TEXT NULL,
  email VARCHAR(320) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)

-- Indexes for query optimization
CREATE INDEX IX_chat_messages_client_conversation 
  ON chat_messages (client_id, conversation_id, created_at);

CREATE INDEX IX_chat_messages_email 
  ON chat_messages (email, created_at) WHERE email IS NOT NULL;
```

**Fields:**
- `id`: Auto-incrementing message ID
- `client_id`: Session identifier (links to chat_sessions)
- `conversation_id`: Groups messages into conversations (64 chars max)
- `chat_mode`: Which mode this conversation used (e.g., 'scripts', 'budget')
- `role`: 'system', 'user', or 'assistant'
- `content`: Message text (can be TEXT or MAX for Azure)
- `model`: Which LLM model responded (stored for audit trail)
- `usage`: JSON object with token counts, costs (stored as TEXT/NVARCHAR)
- `email`: Denormalized email for easier filtering (populated from session)
- `created_at`: Message timestamp

**Indexes:**
- `(client_id, conversation_id, created_at)`: Fast retrieval of messages in a conversation
- `(email, created_at)`: Support email-based conversation queries

**No CRUD for Scenes/Characters:**
- The chatbot **does not store or manage scene or character data**
- Page context is passed as a parameter in API requests, not stored
- Chat messages are stateless text; they don't reference scene IDs or character IDs

---

## 3. Data Flow Architecture

### Request/Response Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client (Web/Embedded)                       │
│                                                                 │
│  POST /api/chat                                                │
│  {                                                             │
│    "chat_mode": "scripts",       ← Which mode (context)       │
│    "conversation_history": [],   ← Prior messages (from client) │
│    "user_message": "...",        ← User input                 │
│    "page_context": "...",        ← Current page info (optional) │
│    "model": "..."                ← Model override (optional)    │
│  }                                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│          Next.js API Route: POST /api/chat/route.js            │
│                                                                 │
│  1. Parse & validate request body                              │
│  2. Find chat mode from modes.js                               │
│  3. Build message array (system prompt + history + user msg)   │
│  4. Derive client_id from session/IP (session.js)             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│    Message Array Builder (lib/server/prompt.js)                │
│                                                                 │
│  Input:                                                         │
│    - systemPrompt (from modes.js, e.g., "You are a...")       │
│    - conversationHistory (prior messages from client)           │
│    - userMessage (current user input)                           │
│    - pageContext (optional: "Project: X. Budget: $Y")          │
│                                                                 │
│  Output: [                                                      │
│    { role: "system", content: "You are a..." },               │
│    { role: "user", content: "Prior question..." },            │
│    { role: "assistant", content: "Prior response..." },       │
│    { role: "user", content: "Current question\n[Page Context]" } │
│  ]                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│   Gateway Client (lib/server/gateway-client.js)                │
│                                                                 │
│   POST https://models.rapidmvp.io/api/execute                 │
│   {                                                            │
│     "provider": "openrouter",                                 │
│     "job_type": "text-completion",                            │
│     "payload": {                                              │
│       "model": "openai/gpt-4-turbo",                          │
│       "messages": [...]  ← built message array               │
│     },                                                         │
│     "dry_run": false,                                         │
│     headers: {                                                │
│       "X-Internal-API-Key": GATEWAY_API_KEY,                │
│       "X-Request-Id": requestId                             │
│     }                                                         │
│   }                                                            │
│                                                                │
│   Features:                                                    │
│   - 2x retry logic for 5xx & 429 errors                       │
│   - 120s timeout (configurable)                               │
│   - Detailed logging for debugging                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│            openrouter-gateway Response                          │
│                                                                 │
│  {                                                             │
│    "status": "success",                                        │
│    "result": {                                                │
│      "choices": [                                             │
│        {                                                       │
│          "message": {                                          │
│            "content": "Here's my response..."                 │
│          }                                                     │
│        }                                                       │
│      ],                                                        │
│      "model": "openai/gpt-4-turbo"                            │
│    },                                                          │
│    "usage": {                                                 │
│      "prompt_tokens": 245,                                    │
│      "completion_tokens": 156,                                │
│      "total_tokens": 401,                                     │
│      "total_cost": 0.00234                                    │
│    }                                                           │
│  }                                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│       Response Handler & Persistence                            │
│                                                                 │
│  Return to client:                                             │
│  {                                                             │
│    "content": "Here's my response...",                         │
│    "model": "openai/gpt-4-turbo",                             │
│    "chat_mode": "scripts",                                    │
│    "usage": {...}   ← Optional, if returned by gateway       │
│  }                                                             │
│                                                                │
│  Optional: Store in DB (if configured)                        │
│    - insertMessages(client_id, conversation_id, ...)         │
│    - Stores both user message and assistant response         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Chat Modes Configuration

**Source File**: `lib/server/modes.js` (SINGLE SOURCE OF TRUTH)

Each mode defines context-aware system prompts for different MovieShaker workflows:

```javascript
{
  id: 'scripts',                    // URL-safe ID
  displayName: 'Scripts',           // UI label
  promptInfo: 'Help with script...', // Info popover text
  systemPrompt: `You are a virtual co-production assistant...`
}
```

### Current Modes:
1. **general** - Production support (projects, workflows, platform guidance)
2. **scripts** - Script management, scene breakdowns, character analysis
3. **budget** - Production budgeting, scene costs, financial planning
4. **scheduling** - Production scheduling, shoot days, crew planning
5. **festivals** - Film festival strategy, submissions, applications
6. **moodboard** - Visual development, moodboards, production design

**No database storage**: Modes are hardcoded in the config file, not queried from DB.

---

## 5. API Endpoints

### Available Endpoints

#### 1. **GET /api/health**
Simple health check (unauthenticated).

```javascript
Response: { "status": "ok" }
```

---

#### 2. **GET /api/chat-modes**
List available chat modes and their display names.

```javascript
Response: {
  "chat_modes": [
    {
      "id": "scripts",
      "displayName": "Scripts",
      "promptInfo": "Help with script management..."
    },
    // ... more modes
  ]
}
```

**No database query**: Returns hardcoded modes from `modes.js`.

---

#### 3. **POST /api/chat**
Main chat endpoint. Send a message, get a response.

**Request:**
```javascript
{
  "chat_mode": "scripts",           // string, optional (defaults to 'general')
  "conversation_history": [         // array, required (can be empty)
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "user_message": "Your question",  // string, required, non-empty
  "page_context": "Project: X...",  // string, optional (passed to LLM, not stored)
  "model": "openai/gpt-4"           // string, optional (override default model)
}
```

**Response:**
```javascript
{
  "content": "Here's my response...",
  "model": "openai/gpt-4-turbo",     // Resolved model used
  "chat_mode": "scripts",            // Echoed mode
  "usage": {                         // Optional, if provided by gateway
    "prompt_tokens": 245,
    "completion_tokens": 156,
    "total_cost": 0.00234
  }
}
```

**Error Response:**
```javascript
{ "error": "Failed to parse request" }        // 400
{ "error": "chat_mode not found" }            // 400
{ "error": "Requested model is not allowed" } // 400
{ "error": "Gateway timeout. Try again." }    // 504
{ "error": "Gateway request failed" }         // 502
```

**Database Operations:**
- No direct DB reads (modes are hardcoded)
- Optional DB writes: Message persistence (if enabled)
  - `insertMessages(clientId, conversationId, chatMode, [userMsg, assistantMsg])`
  - Stores role, content, model, usage, email

---

## 6. Session Management

**Source File**: `lib/server/session.js`

### Session Derivation
Client ID is derived from (in priority order):
1. `session_id` parameter in request body
2. `X-Session-Id` header
3. `?session_id=` query parameter
4. SHA256 hash of IP address (from `X-Forwarded-For` or `X-Real-IP` header)

```javascript
// Example: derive from IP
const ip = request.headers.get('x-forwarded-for').split(',')[0] || 'unknown';
const clientId = crypto.createHash('sha256').update(ip).digest('hex');
```

**No OAuth/Auth**: The chatbot uses simple session tracking, not authentication.

---

## 7. Database Schema & CRUD Operations

### Database Adapters
Two pluggable adapters (selected via environment variables):

#### **PostgreSQL Adapter** (`lib/server/persistence/db-pg.js`)
- Uses `pg` (Node.js PostgreSQL driver)
- Connection string: `POSTGRES_SQL_CONNECTION_STRING`
- Handles SSL, connection pooling

#### **Azure SQL Adapter** (`lib/server/persistence/db-azure.js`)
- Uses `mssql` (Node.js SQL Server driver)
- Server: `AZURE_SQL_SERVER`, Database: `AZURE_SQL_DATABASE`
- User: `AZURE_SQL_USER`, Password: `AZURE_SQL_PASSWORD`
- Handles Azure-specific SQL syntax (e.g., `TOP`, `GETUTCDATE()`)

### CRUD Operations (NO Scenes/Characters)

All CRUD operations work on `chat_sessions` and `chat_messages` tables only.

#### **CREATE**

**`ensureTables()`**
- Creates `chat_sessions` and `chat_messages` if not exist
- Creates indexes for query optimization

**`upsertSession(clientId, email)`**
- INSERT ON CONFLICT / MERGE to upsert session
- Updates `updated_at` timestamp
- Example:
  ```javascript
  await upsertSession('abc123def...', 'producer@movie.com');
  ```

**`insertMessages(clientId, conversationId, chatMode, messages, email)`**
- Inserts multiple messages (user + assistant) in one call
- Messages format: `[{ role: 'user', content: '...' }, { role: 'assistant', content: '...', model: '...', usage: {...} }]`
- Example:
  ```javascript
  await insertMessages(
    'abc123',
    'conv-456',
    'scripts',
    [
      { role: 'user', content: 'What scenes are in act 1?' },
      { role: 'assistant', content: 'Scenes 1-5...', model: 'gpt-4', usage: {...} }
    ],
    'producer@movie.com'
  );
  ```

---

#### **READ**

**`getConversations(clientId, email, chatMode)`**
- Retrieves list of conversations (without messages)
- Returns: `[{ client_id, conversation_id, chat_mode, created_at }, ...]`
- Can filter by mode
- Supports lookup by email (across all client_ids)

**`getConversationsWithPreview(clientId, email, chatMode)`**
- Extends getConversations with first user message (question preview)
- Returns: `[{ client_id, conversation_id, chat_mode, created_at, question_preview }, ...]`
- Useful for conversation list UI

**`getMessages(clientId, conversationId)`**
- Retrieves all messages in a conversation
- Returns: `[{ role, content, model, usage, created_at }, ...]`
- Sorted by created_at (oldest first)
- Parses JSON usage field back to object

**`getConversationsForAdmin(filters)`**
- Admin query with optional filtering
- Filters: `clientId`, `email` (ILIKE), `chatMode`, `limit` (max 500)
- Returns enriched data: question_preview, total_cost aggregation
- Example:
  ```javascript
  const results = await getConversationsForAdmin({
    email: '%john%',
    chatMode: 'scripts',
    limit: 100
  });
  ```

**`getClientIdByEmail(email)`**
- Reverse lookup: email → client_id
- Returns most recently updated session for that email

**`getSessionEmail(clientId)`**
- Reverse lookup: client_id → email
- Returns email associated with session

---

#### **UPDATE**

**`backfillEmailForClient(clientId, email)`**
- Updates all messages for a client without email
- Useful for retroactively associating client activity with email
- Returns count of updated rows
- Example:
  ```javascript
  const updated = await backfillEmailForClient('abc123', 'producer@movie.com');
  // Updated 47 messages
  ```

---

#### **DELETE**

**`deleteConversation(clientId, conversationId)`**
- Deletes all messages in a conversation
- Returns count of deleted rows
- Example:
  ```javascript
  const deleted = await deleteConversation('abc123', 'conv-456');
  // Deleted 12 messages
  ```

---

### NO CRUD for Scenes/Characters

**Important**: The chatbot does NOT implement CRUD for:
- ❌ Scene data (headings, page numbers, lengths)
- ❌ Character data (names, casting notes, images)
- ❌ Project data (budgets, schedules)
- ❌ PDF/JSON storage (scripts)

These operations are performed by **movieshakerv2 engine** (see `engine/scripts.py`, `engine/characters.py`).

---

## 8. Environment Configuration

**Source File**: `lib/server/env.js`

```javascript
// Gateway
GATEWAY_BASE_URL              // e.g., https://models.rapidmvp.io
GATEWAY_API_KEY              // Internal API key for gateway authentication
CHAT_MODEL                   // Default LLM model (e.g., openai/gpt-4)
CHAT_MODEL_ALLOWLIST         // Comma-separated list of allowed models
GATEWAY_TIMEOUT_MS           // Request timeout (default 120000ms)

// Database (pick one: PostgreSQL or Azure)
POSTGRES_SQL_CONNECTION_STRING  // PostgreSQL connection string
AZURE_SQL_CONNECTION_STRING     // OR Azure connection string
AZURE_SQL_SERVER                // OR individual Azure params...
AZURE_SQL_DATABASE
AZURE_SQL_USER
AZURE_SQL_PASSWORD

// CORS & Embedding
CHATBOT_CORS_ALLOWED_ORIGINS      // Comma-separated origins
CHATBOT_FRAME_ANCESTORS           // CSP frame-ancestors values
```

---

## 9. Frontend Data Flow

### React Components

**`ChatbotClient.jsx`** (Main shell)
- State: `chatModes`, `chatMode`, `conversationHistory`, `open`, `panelHeight`, `panelWidth`
- Fetches `/api/chat-modes` on mount
- Renders mode selector, chat panel, resize handle
- Passes conversation history to Chat component

**`Chat.jsx`** (Message interface)
- State: `messages`, `input`, `loading`, `error`
- Sends `POST /api/chat` with:
  - `conversation_history`: Previous messages from local state
  - `user_message`: Current input
  - `page_context`: Passed as prop
  - `model`: Optional override
- Appends response to local `messages` state
- Formats markdown responses via `formatChatContent.js`

**`utils/api.js`**
- Helper to build API URLs: `apiUrl(apiBase, '/api/chat')`

**`utils/cookies.js`**
- Reads/writes email to localStorage for persistence
- Sends email to backend on session creation

### NO Direct Data Binding to Scenes/Characters
- Frontend never queries scene or character data
- Page context is passed as text string, not references
- All movie project data remains in movieshakerv2, not chatbot

---

## 10. Key Architectural Decisions

### 1. **Stateless on Client**
- Conversation history is managed **by the client** (sent with each request)
- Server doesn't fetch prior conversation from DB on every request
- DB used only for audit trail / long-term retention

### 2. **Modes are Hardcoded**
- Chat modes defined in single file (`modes.js`)
- Not database-driven
- System prompts configured at deployment time, not runtime

### 3. **Page Context is Transient**
- Page context (project info, current scene, etc.) passed as text string
- NOT stored in database
- LLM sees it per-request, but no permanent record

### 4. **No Authentication**
- Uses simple session tracking (IP hash or session_id)
- No OAuth or user login required
- Email optional, used for linking conversations

### 5. **Persistence is Optional**
- Database insert only if explicitly called (not automatic)
- In-memory conversation history sufficient for session
- DB is opt-in for audit/analytics

### 6. **Dual Database Support**
- PostgreSQL or Azure SQL (pick one per deployment)
- Same logical schema, different SQL dialect
- Allows flexibility in deployment environment

---

## 11. Data Flow Limitations & Notes

### ❌ NOT Supported
1. **Real-time sync** - Client manages conversation state, no live DB sync
2. **Conversation editing** - Can't edit prior messages in conversation
3. **Multi-user collaboration** - Each client_id is isolated
4. **Cross-project context** - Page context is simple text, not structured data
5. **File uploads** - Chatbot doesn't handle file persistence (movieshakerv2 does)
6. **Scene/Character references** - Chatbot can discuss them, but doesn't manage them

### ✅ Supported
1. **Conversation persistence** - Store & retrieve message history
2. **Mode-based context** - Different prompts per task
3. **Page context** - Pass current project/scene info as text
4. **Multi-model support** - Use different LLMs per request
5. **Email-based lookups** - Find conversations by user email
6. **Admin queries** - Filter conversations by email, mode, client

---

## 12. Integration Points with MovieShakerV2

### Chatbot ← MovieShakerV2
- Chatbot is **embedded into** movieshakerv2 pages
- movieshakerv2 passes `page_context` as parameter to chatbot API
- movieshakerv2 manages all scene/character/budget/project data

### Page Context Examples
```
// When user is in Scripts section:
page_context: "Project: The Last Frame. Script: Draft 3. Scenes: 23. Characters: 8."

// When user is in Scheduling section:
page_context: "Project: The Last Frame. Shoot Days: 15. Crew Size: 12. Locations: 6."

// When user is in Budget section:
page_context: "Project: The Last Frame. Total Budget: £150k. Contingency: 10%."
```

The chatbot receives this as text, processes it through the mode's system prompt, and returns context-aware responses. **No database query** for this data.

---

## Summary Table

| Aspect | Chatbot Project | MovieShakerV2 Project |
|--------|-----------------|----------------------|
| **Manages PDF/JSON?** | ❌ No | ✅ Yes (storage, parsing) |
| **Manages Spaces?** | ❌ No | ✅ Yes (DigitalOcean Spaces) |
| **Manages Scenes?** | ❌ No | ✅ Yes (Scene model, CRUD) |
| **Manages Characters?** | ❌ No | ✅ Yes (Character model, CRUD) |
| **Manages Conversations?** | ✅ Yes | ❌ No |
| **Stores Messages?** | ✅ Yes (optional) | ❌ No |
| **Calls LLM Gateway?** | ✅ Yes | ❌ No (chatbot does) |
| **Has Auth?** | ❌ Simple session only | ✅ SuperTokens |
| **Database** | PostgreSQL / Azure SQL | PostgreSQL (SQLModel ORM) |
| **Embeddable?** | ✅ Yes (iframe, widget) | ✅ Yes (full platform) |

---

## Conclusion

The **chatbot** is a **stateless, mode-driven AI assistant** for conversation management. It does **not** handle data architecture around spaces, PDF/JSON, scenes, or characters. Those responsibilities belong to the **movieshakerv2 engine**.

The chatbot's data architecture is **minimal and focused**:
- Two tables: `chat_sessions` and `chat_messages`
- Simple CRUD operations (no complex joins or relationships)
- Transient context passed per-request, not stored permanently
- System prompts configured at deployment, not dynamic

This clean separation allows the chatbot to be **lightweight, fast, and embeddable** across MovieShakerV2 pages without duplicating the core data models.
