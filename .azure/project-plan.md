# Project Plan

**Status**: Planning
**Created**: 2026-11-17
**Mode**: NEW

---

## 1. Project Overview

**Goal**: Build a basketball community site where fans can share game experiences, discuss players and teams, and read a searchable feed of public posts. The project is designed so that every module is independently testable.

**App Type**: Static + API

**API Login**: No

**Mode**: NEW

**Deployment Plan**: No deployment plan found

---

## 2. Backend - Express.js

| Component | Technology |
|-----------|-----------|
| **Language** | JavaScript |
| **Runtime** | Node |
| **Framework** | Express.js |
| **Package Manager** | npm |
| **Test Runner** | node:test |
| **Mocking Library** | node:test |
| **Test Command** | npm test |
| **Orchestration** | docker-compose |

---

## 3. Frontend — Web App

| Component | Technology |
|-----------|-----------|
| **Language** | JavaScript |
| **Framework** | Plain HTML + CSS + JavaScript |
| **Package Manager** | npm |
| **Test Runner** | node:test |
| **Mocking Library** | node:test |
| **Test Command** | npm test |

---

## 4. Services Required

| Azure Service | Role in App | Environment Variable | Default Value (Local) | Classification |
|---------------|------------|---------------------|----------------------|----------------|
| Azure App Service | Hosts the Express API and static frontend assets | `PORT` | `3000` | Essential |
| Azure Database for PostgreSQL Flexible Server | Stores forum posts, comments, and community content | `DATABASE_URL` | `postgresql://appuser:password@localhost:5432/courtside` | Essential |

---

## 5. Prerequisites

### Run

| Tool | Service(s) | Installed | Version |
|------|------------|-----------|---------|
| Node.js | * | ✅ | 24.20.0 |
| npm | * | ✅ | 11.19.0 |
| Azure CLI | Backend | ❓ | unknown |
| PostgreSQL client tools | Backend | ❓ | unknown |

### Debug

| Tool | Service(s) | Installed | Version |
|------|------------|-----------|---------|
| Docker Desktop | Backend | ❓ | unknown |
| Docker Compose | Backend | ❓ | unknown |
| VS Code extension: `ms-vscode.js-debug` | Frontend | ❓ | unknown |
| VS Code extension: `ms-azuretools.vscode-azureappservice` | Backend | ❓ | unknown |

---

## 6. Design System & UI

**Component Library**: Pico.css
**Style Direction**: Clean, high-contrast sports community UI with rounded cards, scannable article layouts, and a strong emphasis on readable discussion threads and headline stories.
**Typography**: Inter, system-ui

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#D9485F` | Brand color for key actions and active community calls to action |
| `accent`  | `#F4B942` | Secondary highlights for game-day badges and category tags |
| `surface` | `#F7F8FA` | Page and card backgrounds for feed, comments, and forms |
| `text`    | `#1B1B1F` | Body text and article content |
| `muted`   | `#667085` | Secondary text, timestamps, and metadata |
| `border`  | `#DDE2EA` | Dividers, inputs, and card borders |

### Pages

| Page | Route | Purpose | Layout |
|------|-------|---------|--------|
| Feed | `/` | Browse the latest community posts and filter by topic | `header + hero + list + filters + table` |
| Create Post | `/create.html` | Publish a new fan story or game reaction | `header + form + action-bar` |
| Post Detail | `/post.html?id=<post-id>` | Read the full post and thread of comments | `two-column(media+meta) + actions + card-list` |

### Sample Content

```
Home Feed — posts:
| Title | Category | Author | Status |
| The comeback of the season | Game Experience | Alex | Published |
| Why the second unit is a problem | Basketball Opinions | Jordan | Published |
| Best defensive rotations from last night | Player Discussion | Anonymous | Published |

Create Post — fields: Title: The kind of game we will remember · Category: Game Experience
Post Detail — comments:
| Author | Comment | Status |
| Mia | That fourth-quarter push was unreal. | Visible |
| Sam | The bench energy changed the whole game. | Visible |
| Anonymous | This is exactly why we watch playoff basketball. | Visible |
```

---

## 7. Project Structure

```text
courtside/
├── public/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── create.js
│   │   ├── main.js
│   │   ├── post.js
│   │   └── shared.js
│   ├── create.html
│   ├── index.html
│   └── post.html
├── .azure/
│   ├── .preview-temp/
│   ├── project-plan.md
│   └── requirements.json
├── data.json
├── index.js
├── package.json
├── README.md
├── test/
│   └── app.test.js
└── .gitignore
```

---

## 8. Route Definitions

| # | Method | Path | Description | Request Body | Response Body | Status Codes |
|---|--------|------|-------------|-------------|--------------|-------------|
| 1 | GET | `/api/health` | Health check | — | `{ status, services }` | 200, 503 |
| 2 | GET | `/api/posts` | Return the latest posts, newest first | — | `Post[]` | 200 |
| 3 | GET | `/api/posts/:id` | Return a single post by ID | — | `Post` | 200, 400, 404 |
| 4 | POST | `/api/posts` | Create a new post | `{ name, title, category, playerOrTeam, gameDetails, content }` | `Post` | 201, 400 |
| 5 | GET | `/api/posts/:id/comments` | Return a post’s comments in chronological order | — | `Comment[]` | 200, 400, 404 |
| 6 | POST | `/api/posts/:id/comments` | Add a new comment to a post | `{ name, content }` | `Comment` | 201, 400, 404 |

---

## 9. Next Steps

1. Run **azure-project-scaffold** to execute this plan
2. Run **azure-project-integrate** to wire the frontend to live data, smoke-test the backend, and create the migrations
3. Run **azure-debug-plan** → **azure-debug-generate** for Docker emulators and VS Code debugging
4. Run the **azure-deploy** agent when ready; it uses **azure-app-onboard** for architecture, cost estimation, IaC generation, provisioning, and health verification
