# DataLens - Setup & Deployment Guide

Welcome to **DataLens**! This guide is written specifically for beginners. We will walk you through exactly how to get this project running on your own computer, and how you can host it on the internet for **100% free**.

---

## 🛠️ Phase 1: Local Setup (Running on your computer)

### 1. Prerequisites
Before you start, make sure you have installed:
1. **[Node.js](https://nodejs.org/en/)** (LTS Version) - This runs the code.
2. **[Git](https://git-scm.com/downloads)** - For downloading the code.

### 2. Download and Install
Open your Terminal (Mac) or Command Prompt (Windows) and run these commands:

```bash
# 1. Clone the code to your computer
git clone <YOUR_REPOSITORY_URL>

# 2. Go into the folder
cd datalens

# 3. Install all the required packages
npm install
```

### 3. Setup Firebase (Free Database & Authentication)
DataLens uses Firebase to store user settings and chat histories. 
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Create a Project** and give it a name (e.g., "DataLens App"). (You can disable Google Analytics for now).
3. Once the project is ready, click on the **Web icon (`</>`)** to add a web app. Register it with a name.
4. It will show you a "Firebase SDK Configure" block holding your API keys. Keep this window open.

**Enable Firestore (Database):**
1. On the left menu, click **Firestore Database** -> **Create database**.
2. Start in **Test Mode** (you can secure it later).
3. Choose a location close to you and click Enable.

**Enable Authentication:**
1. On the left menu, click **Authentication** -> **Get Started**.
2. Go to the **Sign-in method** tab.
3. Click **Google** and enable it. (You will need to select a support email).
4. *(Optional)* You can also enable **Email/Password**.

### 4. Create your Environment Variables
Your app needs to know your Firebase secrets to connect to it.

1. In the root folder of your project (where `package.json` is), create a new file and name it exactly **`.env.local`**.
2. Open `.env.local` and paste the following template, filling in the values from your Firebase setup earlier:

```env
# ----- FIREBASE CONFIG -----
# Get these from the Firebase Console -> Project Settings -> General -> Your apps
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="your-measurement-id"

# ----- NEXT-AUTH CONFIG -----
# Run `openssl rand -base64 32` in your terminal to generate a random secret, or just type a very long random string
NEXTAUTH_SECRET="your-super-secret-random-string-here"

# Your Google Auth Client keys (Get these from Google Cloud Console if Google Login is needed)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 5. Start the App!
Run this command in your terminal:

```bash
npm run dev
```

Open **http://localhost:3000** in your browser. The app should now be running! 
*Note: You will input your **OpenRouter API Key** directly in the app's user interface when you want to use the AI chat.*

---

## 🌍 Phase 2: How to Host This For Completely FREE

Yes, you can host this entire stack for **100% free**! Here is how the free stack breaks down:

1. **Frontend & Serverless Backend: [Vercel](https://vercel.com)** 
   Vercel's "Hobby" plan is completely free and specifically optimized for Next.js projects.
2. **Database & Authentication: [Firebase](https://firebase.google.com)**
   Firebase's default "Spark" plan is entirely free and has highly generous limits.
3. **AI Models / LLMs: [OpenRouter](https://openrouter.ai)**
   OpenRouter has a category of **"Free"** models (including Meta's Llama 3 and Google's Gemma). You can use the app without paying a single cent for API credits if you stick to the free models!

### Deployment Steps (Vercel):
1. **Push your code to GitHub:**
   Make sure all your code is uploaded to a free GitHub repository.
2. **Deploy on Vercel:**
   - Go to [Vercel.com](https://vercel.com) and log in with your GitHub account.
   - Click **Add New Project** and select your `datalens` GitHub repository.
   - Expand the **Environment Variables** section. Add every single variable from your `.env.local` file here.
   - *Important*: Add one new environment variable: `NEXTAUTH_URL` and set its value to your Vercel production deployment URL (e.g., `https://my-datalens-app.vercel.app`). *You might have to add this after Vercel generates your initial domain name.*
3. **Click Deploy!**
   Vercel will build your app and give you a live HTTPS web address. Whenever you push new code to GitHub, Vercel will automatically re-deploy your app.
