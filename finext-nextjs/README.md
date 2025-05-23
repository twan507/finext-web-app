<div align="center"><strong>Finext Next.js Web App</strong></div>
<div align="center">Built with Next.js 15 App Router</div>
<br />

## Overview

This is a Next.js frontend application using the following stack:

- Framework - [Next.js 15 (App Router)](https://nextjs.org)
- Language - [TypeScript](https://www.typescriptlang.org)
- Styling - [Tailwind CSS](https://tailwindcss.com)
- Components - [Radix UI](https://www.radix-ui.com/)
- Analytics - [Vercel Analytics](https://vercel.com/analytics)
- Formatting - [Prettier](https://prettier.io)

This application serves as the frontend client for the Finext FastAPI backend, handling user authentication through direct API calls and managing session state with localStorage.

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment setup:**
   Create a `.env` file in the root directory:
   ```bash
   NEXT_PUBLIC_FASTAPI_BASE_URL=http://127.0.0.1:8000
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Backend Integration

This frontend is designed to work with the Finext FastAPI backend. Make sure the FastAPI server is running on `http://127.0.0.1:8000` before using the application.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier