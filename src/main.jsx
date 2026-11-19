import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const Admin = lazy(() => import('./admin/Admin.jsx'))
const BlogIndex = lazy(() => import('./blog/BlogIndex.jsx'))
const BlogPost = lazy(() => import('./blog/BlogPost.jsx'))

const path = window.location.pathname.replace(/\/+$/, '') || '/'
let page = <App />
if (path === '/admin') page = <Admin />
else if (path === '/blog') page = <BlogIndex />
else if (path.startsWith('/blog/')) page = <BlogPost slug={decodeURIComponent(path.slice(6))} />

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Suspense fallback={<div className="min-h-svh bg-ink" />}>{page}</Suspense>
  </StrictMode>,
)
