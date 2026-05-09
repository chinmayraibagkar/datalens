# ◈ DataLens AI — Your Conversational Data Analyst

<div align="center">

**An AI-powered, agentic data analyst that connects to BigQuery, Google Ads, and Meta Ads — ask questions in plain English, get SQL, visualizations, and insights instantly.**

[![Version](https://img.shields.io/badge/version-0.6.0-blue.svg)](https://github.com/chinmayraibagkar/datalens)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

</div>

---

## 🎯 What is DataLens?

DataLens is a **self-hosted, conversational data analytics platform** that lets you query your data using natural language. Instead of writing SQL manually or navigating complex ad dashboards, you simply chat with an AI agent that:

- 📊 **Writes & executes SQL** against your BigQuery tables
- 📈 **Pulls live metrics** from Google Ads and Meta Ads campaigns
- 📉 **Generates interactive visualizations** (charts, tables) from query results
- 🧠 **Reasons through multi-step analysis** using an agentic tool-use loop
- 🔐 **Keeps everything private** — your API keys stay in your browser, data never leaves your infrastructure

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      DataLens UI (Next.js)                   │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Chat   │  │ Settings │  │  Usage   │  │  Model       │  │
│  │Interface│  │   Page   │  │ Tracker  │  │  Selector    │  │
│  └────┬────┘  └────┬─────┘  └──────────┘  └──────────────┘  │
│       │            │                                         │
│  ┌────▼────────────▼────────────────────────────────────┐    │
│  │              Zustand State Store                      │    │
│  │  (API keys, models, conversations, preferences)      │    │
│  └───────────────────┬──────────────────────────────────┘    │
└──────────────────────┼───────────────────────────────────────┘
                       │
                ┌──────▼──────┐
                │  /api/chat  │ ← Server-side API route
                │  (Agentic   │
                │   Loop)     │
                └──────┬──────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────▼────┐  ┌─────▼─────┐ ┌────▼────┐
    │   LLM   │  │   Tools   │ │  Tools  │
    │ Adapter │  │ (BigQuery)│ │  (Ads)  │
    └────┬────┘  └───────────┘ └─────────┘
         │
    ┌────▼────────────────────────────────────┐
    │         Provider Layer                   │
    │  Gemini │ Anthropic │ OpenAI │ Grok     │
    │  OpenRouter │ Ollama │ LM Studio        │
    │  Local Server                            │
    └──────────────────────────────────────────┘
```

---

## ✨ Features

### 🤖 Multi-Provider LLM Support
| Provider | Type | Tool Use | Notes |
|----------|------|----------|-------|
| **Google Gemini** | Cloud API | ✅ | Pro, Flash, Thinking models |
| **Anthropic Claude** | Cloud API | ✅ | Opus, Sonnet |
| **OpenAI GPT** | Cloud API | ✅ | GPT-4o, o1, o3 |
| **xAI Grok** | Cloud API | ✅ | Grok-3 |
| **OpenRouter** | Cloud API | ✅ | 300+ models, many free |
| **Ollama** | Local | ✅ | Any GGUF model |
| **LM Studio** | Local | ✅ | Load/unload model management |
| **Custom Local Server** | Local | ✅ | Anthropic-compatible API |

### 📊 Data Source Integrations
- **BigQuery** — OAuth-based connection, schema discovery, SQL execution
- **Google Ads** — Campaign metrics, keyword performance, ad group analysis
- **Meta Ads** — Campaign insights, ad set performance, demographic breakdown

### 🛠️ Agentic Capabilities
The AI agent doesn't just answer questions — it **takes actions**:
1. Analyzes your question and selects the right tool (SQL, Ads API, etc.)
2. Executes the tool and inspects the results
3. Generates follow-up queries or visualizations if needed
4. Presents a final, polished answer with data + charts

### 🖥️ LM Studio Integration (v0.6)
- **One-click model discovery** — fetches all downloaded models with full metadata
- **Load / Eject controls** — load models into VRAM, eject to free RAM
- **Rich model cards** — see params, quantization, context window, tool support, vision capabilities
- **Full agentic flow** — local models can use all the same tools as cloud models

### 📈 Additional Features
- 🌙 Dark/Light theme with smooth transitions
- 💬 Persistent conversation history (via Firebase)
- 📊 Token usage tracking with cost estimation
- 🔐 Firebase authentication with Google Sign-In
- 📥 Export query results to CSV/Excel
- 🧠 Thinking/reasoning mode for supported models
- 📝 Custom system prompt editor
- 🌡️ Temperature control slider

---

## 📂 Project Structure

```
datalens/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/
│   │   │   ├── chat/route.js         # Main agentic chat endpoint (SSE)
│   │   │   ├── lmstudio/route.js     # LM Studio proxy (avoids CORS)
│   │   │   ├── bigquery/             # BigQuery OAuth & query execution
│   │   │   ├── ads/                  # Google Ads & Meta Ads API routes
│   │   │   ├── auth/                 # NextAuth.js handlers
│   │   │   └── download/             # CSV/Excel export
│   │   ├── settings/page.js          # Settings page route
│   │   ├── usage/page.js             # Usage tracking page route
│   │   ├── globals.css               # Full design system (dark/light)
│   │   └── layout.js                 # Root layout with providers
│   │
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── ChatInterface.jsx     # Main chat UI with model selector
│   │   │   ├── MessageBubble.jsx     # Message rendering (markdown, SQL, charts)
│   │   │   ├── TableSelector.jsx     # BigQuery table picker panel
│   │   │   ├── AdsAccountSelector.jsx # Ads account picker panel
│   │   │   └── AgentProgress.jsx     # Real-time agentic step tracker
│   │   ├── Layout/
│   │   │   └── AppShell.jsx          # Sidebar, header, conversation list
│   │   ├── Settings/
│   │   │   └── SettingsPage.jsx      # API keys, local models, prompts, ads config
│   │   ├── Usage/
│   │   │   └── UsageDashboard.jsx    # Token usage charts & cost tracking
│   │   └── Auth/                     # Firebase auth components
│   │
│   ├── services/
│   │   ├── llm/
│   │   │   ├── adapter.js            # Unified LLM router (provider → function)
│   │   │   ├── model-registry.js     # Model definitions & provider metadata
│   │   │   └── providers/
│   │   │       ├── gemini.js          # Google Gemini (chat + tools)
│   │   │       ├── anthropic.js       # Anthropic Claude
│   │   │       ├── openai.js          # OpenAI GPT
│   │   │       ├── grok.js            # xAI Grok
│   │   │       ├── openrouter.js      # OpenRouter (300+ models)
│   │   │       ├── ollama.js          # Ollama local models
│   │   │       ├── lmstudio.js        # LM Studio (chat + model mgmt)
│   │   │       └── local-server.js    # Custom Anthropic-compat server
│   │   ├── firebase.js               # Firebase init & Firestore helpers
│   │   ├── mcp/                      # MCP tool definitions
│   │   └── prompts/                  # System prompt builders
│   │
│   └── store/
│       └── app-store.js              # Zustand global state (persisted)
│
├── .env.local                        # Environment variables (NOT committed)
├── package.json
├── next.config.mjs
├── SETUP_GUIDE.md                    # Detailed setup instructions
└── README.md                         # This file
```

---

## 🚀 Quick Start

### Prerequisites
- **[Node.js](https://nodejs.org/)** v18+ (LTS recommended)
- **[Git](https://git-scm.com/downloads)**
- At least one LLM provider:
  - A cloud API key (Gemini, OpenAI, Anthropic, etc.), **OR**
  - [Ollama](https://ollama.ai/) or [LM Studio](https://lmstudio.ai/) running locally

### 1. Clone & Install

```bash
git clone https://github.com/chinmayraibagkar/datalens.git
cd datalens
npm install
```

### 2. Configure Environment

Create a `.env.local` file in the root directory:

```env
# ─── NextAuth (required for BigQuery OAuth) ───
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# ─── Firebase (required for auth & data persistence) ───
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

> 💡 See the full **[SETUP_GUIDE.md](SETUP_GUIDE.md)** for step-by-step instructions on creating Firebase and Google Cloud projects.

### 3. Run

```bash
npm run dev
```

Open **http://localhost:3000** — you're in! 🎉

### 4. Add API Keys

Go to **Settings → API Keys** and add your LLM provider keys. You can also connect to local models via the **Local Models** tab.

---

## 🖥️ Local Model Setup

### Ollama
1. Install Ollama from [ollama.ai](https://ollama.ai/)
2. Pull a model: `ollama pull llama3.2`
3. In DataLens Settings → Local Models → Ollama, click **Fetch Models**

### LM Studio
1. Install LM Studio from [lmstudio.ai](https://lmstudio.ai/)
2. Download models from the LM Studio Discover tab
3. Start the local server: **Developer tab → Start Server** (default port: 1234)
4. In DataLens Settings → Local Models → LM Studio, click **Fetch Models**
5. Use **▶️ Load** and **⏏️ Eject** buttons to manage which model is in memory

---

## 🔄 Version History

| Version | Highlights |
|---------|-----------|
| **v0.6** | 🧪 LM Studio integration with model load/unload management |
| **v0.5** | 🔐 Firebase auth, 🌐 OpenRouter (300+ models), Security hardening |
| **v0.4** | 📈 Google Ads integration, Account hierarchy support |
| **v0.3** | 📊 Meta Ads integration, Enhanced markdown tables |
| **v0.2** | 🧠 Multi-provider support, Tool-use agentic loop |
| **v0.1** | 🚀 Initial release — Gemini + BigQuery chat |

---

## 🛡️ Security Notes

- **API keys are stored client-side** (browser localStorage via Zustand) — they are never sent to any server except the respective LLM provider.
- **BigQuery OAuth tokens** are handled by NextAuth.js and only used server-side.
- **Firebase credentials** in `.env.local` are safe to use client-side (they are scoped by Firestore security rules).
- **No telemetry or analytics** — DataLens does not phone home.

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or PR on [GitHub](https://github.com/chinmayraibagkar/datalens).

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with ❤️ using Next.js, React, and a whole lot of AI

**[⭐ Star this repo](https://github.com/chinmayraibagkar/datalens)** if you find it useful!

</div>
