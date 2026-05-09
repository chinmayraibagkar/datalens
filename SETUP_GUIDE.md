# DataLens — Complete Setup & Deployment Guide

Welcome to **DataLens**! This guide walks you through everything — from running the app locally, to connecting data sources, to hosting it on the internet for free.

---

## Table of Contents

1. [Prerequisites](#-1-prerequisites)
2. [Local Installation](#-2-local-installation)
3. [Firebase Setup (Auth & Database)](#-3-firebase-setup)
4. [Google Cloud Setup (BigQuery OAuth)](#-4-google-cloud-setup-bigquery-oauth)
5. [Environment Variables](#-5-environment-variables)
6. [Running the App](#-6-running-the-app)
7. [Connecting LLM Providers](#-7-connecting-llm-providers)
8. [Connecting Data Sources](#-8-connecting-data-sources)
9. [Local Model Setup (Ollama & LM Studio)](#-9-local-model-setup)
10. [Free Cloud Deployment (Vercel)](#-10-free-cloud-deployment)
11. [Troubleshooting](#-11-troubleshooting)

---

## 🛠 1. Prerequisites

Before you start, install the following on your computer:

| Tool | Purpose | Download |
|------|---------|----------|
| **Node.js** (v18+) | Runs the application | [nodejs.org](https://nodejs.org/) (LTS version) |
| **Git** | Version control & cloning | [git-scm.com](https://git-scm.com/downloads) |
| **npm** | Package manager | Comes with Node.js |

Verify installation:
```bash
node --version    # Should show v18.x or higher
npm --version     # Should show 9.x or higher
git --version     # Should show git version 2.x
```

---

## 📥 2. Local Installation

```bash
# 1. Clone the repository
git clone https://github.com/chinmayraibagkar/datalens.git

# 2. Navigate into the project folder
cd datalens

# 3. Install all dependencies
npm install
```

> ⏱️ `npm install` may take 1-2 minutes on the first run.

---

## 🔥 3. Firebase Setup

DataLens uses Firebase for **user authentication** (Google Sign-In) and **data persistence** (storing settings, conversations, and usage data in Firestore).

### Step 3.1 — Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"** (or "Add project")
3. Enter a project name (e.g., `datalens-app`)
4. You can **disable Google Analytics** (it's not needed)
5. Click **Create project** and wait for it to finish

### Step 3.2 — Register a Web App

1. In your new project's dashboard, click the **Web icon** (`</>`) to add a web app
2. Enter a nickname (e.g., `datalens-web`)
3. You do **NOT** need to set up Firebase Hosting — skip that option
4. Click **Register app**
5. Firebase will show you a config block like this — **copy these values**, you'll need them for `.env.local`:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
  measurementId: "G-XXXXXXXXX"
};
```

### Step 3.3 — Enable Firestore Database

1. In the Firebase Console left sidebar, click **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (for development — you can tighten rules later)
4. Select a Cloud Firestore location closest to you
5. Click **Enable**

### Step 3.4 — Enable Authentication

1. In the left sidebar, click **"Authentication"**
2. Click **"Get started"**
3. Go to the **"Sign-in method"** tab
4. Click **"Google"** and toggle it **ON**
5. Select a support email address (your email)
6. Click **Save**

> 💡 Firebase Authentication is used for the in-app login. Google OAuth (next section) is used separately for BigQuery access.

---

## ☁️ 4. Google Cloud Setup (BigQuery OAuth)

This step is **only needed if you want to query BigQuery**. Skip it if you only plan to use Ads integrations or local data.

### Step 4.1 — Create an OAuth 2.0 Client

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select (or create) the same project as your Firebase project
3. Navigate to **APIs & Services → Credentials**
4. Click **"+ CREATE CREDENTIALS" → "OAuth client ID"**
5. If prompted, configure the **OAuth Consent Screen** first:
   - Choose **External** user type
   - Fill in the app name, user support email, developer email
   - Add scope: `https://www.googleapis.com/auth/bigquery`
   - Add your email as a test user
6. Back in Credentials, create an OAuth client:
   - Application type: **Web application**
   - Name: `DataLens`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
   - (For production, also add your Vercel URL: `https://your-app.vercel.app/api/auth/callback/google`)
7. Copy the **Client ID** and **Client Secret**

### Step 4.2 — Enable the BigQuery API

1. Go to **APIs & Services → Library**
2. Search for **"BigQuery API"**
3. Click **Enable**

---

## 🔑 5. Environment Variables

Create a file called `.env.local` in the **root of your project** (same folder as `package.json`):

```env
# ─── NextAuth Configuration ───
# Used for BigQuery OAuth. Generate a secret with: openssl rand -base64 32
NEXTAUTH_SECRET=paste-a-long-random-string-here
NEXTAUTH_URL=http://localhost:3000

# Google OAuth (from Step 4.1)
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# ─── Firebase Configuration ───
# Get these from Step 3.2 (Firebase web app config)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXX
```

> ⚠️ **Never commit `.env.local` to Git!** It's already in `.gitignore`.

### Generating NEXTAUTH_SECRET

Run this in your terminal:
```bash
# On Mac/Linux:
openssl rand -base64 32

# On Windows (PowerShell):
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])

# Or just type a very long random string — any 32+ character string works
```

---

## ▶️ 6. Running the App

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

You should see:
- The **DataLens AI** sidebar with the version badge
- A chat interface in the center
- A **Settings** link in the sidebar

### First Things to Do

1. **Sign in** with Google (if Firebase Auth is configured)
2. Go to **Settings → API Keys** and add at least one LLM provider key
3. Go to **Settings → Local Models** if you want to use Ollama or LM Studio
4. Go to **Settings → BigQuery** and connect your Google account (if needed)

---

## 🤖 7. Connecting LLM Providers

DataLens supports 8 different LLM providers. You only need **one** to get started.

### Cloud Providers (API Key Required)

Go to **Settings → API Keys** and paste your key:

| Provider | Get API Key | Free Tier? |
|----------|-------------|------------|
| **Google Gemini** | [aistudio.google.com](https://aistudio.google.com/apikey) | ✅ Generous free tier |
| **Anthropic** | [console.anthropic.com](https://console.anthropic.com/) | ❌ Paid only |
| **OpenAI** | [platform.openai.com](https://platform.openai.com/api-keys) | ❌ Paid only |
| **xAI Grok** | [console.x.ai](https://console.x.ai/) | ✅ Free credits on signup |
| **OpenRouter** | [openrouter.ai/keys](https://openrouter.ai/keys) | ✅ Many free models |

### Local Providers (Free, No API Key)

See [Section 9](#-9-local-model-setup) for Ollama and LM Studio setup.

---

## 📊 8. Connecting Data Sources

### BigQuery

1. Go to **Settings → BigQuery**
2. Click **"Connect Google Account"** — this uses OAuth to get a temporary access token
3. Enter your **GCP Project ID** (e.g., `my-company-analytics`)
4. Click **"Fetch Datasets"** to discover available tables
5. In the Chat view, click the **"Tables"** button to select which tables the AI can query

### Google Ads

1. Go to **Settings → Ad Platforms**
2. Enable **Google Ads** and enter:
   - **Developer Token** — from your [Google Ads API Center](https://ads.google.com/aw/apicenter)
   - **OAuth Client ID & Secret** — same as BigQuery, or create a new one
   - **Refresh Token** — generate using [Google OAuth Playground](https://developers.google.com/oauthplayground/)
   - **Manager Account ID** (MCC) — if you manage multiple accounts
3. Click **"Fetch Accounts"** to discover linked ad accounts

### Meta Ads

1. Go to **Settings → Ad Platforms**
2. Enable **Meta Ads** and enter:
   - **Access Token** — from [Meta Business Developer Portal](https://developers.facebook.com/tools/explorer/)
3. Click **"Fetch Accounts"** to discover your ad accounts

---

## 🖥 9. Local Model Setup

### Ollama

[Ollama](https://ollama.ai/) lets you run open-source models locally.

```bash
# 1. Install Ollama (see ollama.ai for your OS)

# 2. Pull a model
ollama pull llama3.2
ollama pull qwen2.5:7b

# 3. Verify it's running
ollama list
```

In DataLens:
1. Go to **Settings → Local Models → Ollama**
2. Base URL should be `http://localhost:11434` (default)
3. Click **"Fetch Models"** — your pulled models will appear
4. Select one from the Chat dropdown to start using it

### LM Studio

[LM Studio](https://lmstudio.ai/) provides a GUI for downloading and managing local models with advanced controls.

**Setup:**
1. Install LM Studio from [lmstudio.ai](https://lmstudio.ai/)
2. Open LM Studio and download models from the **Discover** tab
3. Go to the **Developer** tab and click **"Start Server"**
   - Default port: `1234`
   - The server URL will be: `http://localhost:1234`

**In DataLens:**
1. Go to **Settings → Local Models → LM Studio**
2. Base URL should be `http://localhost:1234` (default)
3. Click **"Fetch Models"** — all your downloaded models will appear with rich metadata:
   - **Parameter count** (7B, 13B, 70B, etc.)
   - **Quantization** (Q4_K_M, Q8_0, F16, etc.)
   - **Context window** (max tokens)
   - **Capabilities** (🔧 Tool Use, 👁️ Vision)
   - **File size** (in GB)
4. Click **"▶️ Load"** to load a model into memory (VRAM/RAM)
5. Click **"⏏️ Eject"** to unload a model and free memory
6. Loaded models show a green **"● LOADED"** badge
7. Select a loaded model from the Chat dropdown to use it

> 💡 **RAM Management Tip:** Only load one model at a time. Use "Eject" to free memory before loading a different model.

> ⚠️ **Tool Use:** For best agentic performance (SQL queries, Ads data), use models that show the 🔧 Tools badge — these were specifically trained for function calling (e.g., Qwen 2.5 Instruct, Llama 3.1 Instruct, Mistral Instruct).

---

## 🌍 10. Free Cloud Deployment

You can host the entire stack for **$0/month** using:

| Service | Role | Free Tier |
|---------|------|-----------|
| **[Vercel](https://vercel.com)** | Frontend + API routes | Hobby plan (free) |
| **[Firebase](https://firebase.google.com)** | Auth + Database | Spark plan (free) |
| **[OpenRouter](https://openrouter.ai)** | LLM API | Free models available |

### Deploy to Vercel

1. **Push your code to GitHub** (if not already):
   ```bash
   git add -A
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com) and sign in with GitHub
   - Click **"Add New Project"**
   - Select your `datalens` repository
   - Framework: **Next.js** (auto-detected)

3. **Add Environment Variables:**
   - In the Vercel project settings, go to **Settings → Environment Variables**
   - Add every variable from your `.env.local` file
   - **Important:** Change `NEXTAUTH_URL` to your Vercel domain (e.g., `https://datalens-xyz.vercel.app`)

4. **Update Google OAuth Redirect URI:**
   - Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
   - Edit your OAuth client
   - Add your Vercel URL to **Authorized redirect URIs**: `https://your-app.vercel.app/api/auth/callback/google`

5. **Deploy!**
   - Click **Deploy** — Vercel will build and host your app
   - Every push to `main` will auto-deploy

---

## 🔧 11. Troubleshooting

### "Failed to fetch" when fetching LM Studio models
- **Cause:** LM Studio server is not running
- **Fix:** Open LM Studio → Developer tab → Click "Start Server"

### "Ollama connection failed"
- **Cause:** Ollama is not running or is on a different port
- **Fix:** Run `ollama serve` in your terminal, or check the base URL in Settings

### BigQuery "Access Denied" or "Permission Denied"
- **Cause:** Your Google account doesn't have BigQuery access to the specified project
- **Fix:** Ensure the Google account you signed in with has `BigQuery Data Viewer` role on the GCP project

### "NEXTAUTH_SECRET is not set"
- **Cause:** Missing `.env.local` file or the variable is empty
- **Fix:** Create `.env.local` with a random string for `NEXTAUTH_SECRET` (see [Section 5](#-5-environment-variables))

### Chat returns "Unknown provider"
- **Cause:** Selected a model whose provider isn't configured
- **Fix:** Add the API key for that provider in Settings → API Keys

### LM Studio model won't load
- **Cause:** Insufficient RAM/VRAM for the model
- **Fix:** Eject other loaded models first, or try a smaller quantization (e.g., Q4 instead of Q8)

### Models don't appear in the chat dropdown
- **Cause:** Models haven't been fetched yet
- **Fix:** Go to Settings → Local Models and click "Fetch Models" for Ollama or LM Studio

---

## 📬 Support

- **GitHub Issues:** [github.com/chinmayraibagkar/datalens/issues](https://github.com/chinmayraibagkar/datalens/issues)
- **Author:** Chinmay Raibagkar Jain

---

<div align="center">

**Happy querying! 🎉**

</div>
