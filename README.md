


# 🚀 Nuxt + Convex Todo Template

A modern, full-stack Todo application starter kit powered by **Nuxt 3**, **Convex**, and **Tailwind CSS**. This template provides a seamless developer experience with real-time backend updates and a high-performance frontend.

---

## 🛠️ Installation Guide

Follow these steps to get your development environment up and running.

### 1. Clone the Repository
```bash
git clone https://github.com/mayank-muthanna/nuxt-convex-todo-template.git
cd nuxt-convex-todo-template
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Initialize Convex Backend
Run the following command to link your local environment to the Convex cloud logic:
```bash
npx convex dev
```
**What this does:**
*   Prompts you to **Login/Signup** to Convex.
*   Prompts you to **Create a new project**.
*   **Auto-registers** your backend schema and functions.
*   **Auto-generates** your `.env.local` file with the necessary API keys.

### 4. Start the Frontend
Open a **new terminal** and launch the Nuxt development server:
```bash
npm run dev
```
> Your application is now live at: **`http://localhost:3000`**

---

## 🏗️ Project Architecture

### Backend (Convex)
Convex manages your database, serverless functions, and real-time synchronization.

| File | Description |
| :--- | :--- |
| `convex/schema.ts` | Defines the data structure and table indexes. |
| `convex/tasks.ts` | Contains the backend logic (Queries & Mutations). |

### Frontend (Nuxt)
A modern Vue.js framework styled with Tailwind CSS.

| File/Folder | Description |
| :--- | :--- |
| `app/app.vue` | The main entry point and UI layout (Tailwind integrated). |
| `app/pages/` | Handles the application routing. |

---

## 📂 Directory Structure

```text
nuxt-convex-todo-template/
├── convex/              # Backend logic (Convex)
│   ├── schema.ts        # Database Schema
│   └── tasks.ts         # API Functions
├── app/                 # Nuxt Frontend
│   ├── app.vue          # Main UI file
│   └── pages/           # App routes
├── .env.local           # Auto-generated API keys
├── nuxt.config.ts       # Nuxt configuration
└── package.json         # Project dependencies
```

---

## 📖 Reference Documentation

Stay informed with the official documentation for the technologies used in this template:

*   **[Convex + Nuxt Quickstart](https://docs.convex.dev/quickstart/nuxt)** – Learn how to integrate Convex with Nuxt.
*   **[Nuxt Directory Structure](https://nuxt.com/docs/4.x/directory-structure/app/pages)** – Understanding the Nuxt 4/v3 layout.
*   **[Tailwind CSS](https://tailwindcss.com/docs)** – Rapidly build custom user interfaces.

---

### 📝 Notes
- Ensure you keep your `npx convex dev` terminal running while developing to allow for real-time schema updates.
- All backend functions are automatically synced to the cloud upon saving.

---
*Built with ❤️ using Nuxt and Convex.*
