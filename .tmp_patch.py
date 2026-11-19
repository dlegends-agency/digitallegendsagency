def patch(p, pairs):
    s=open(p,encoding='utf-8').read()
    for a,b in pairs:
        assert a in s, (p, a[:80])
        s=s.replace(a,b,1)
    open(p,'w',encoding='utf-8').write(s)
patch('src/admin/ui.jsx',[("  check: <path","  pen: <path d=\"M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1zM14 7l3 3\" />,\n  check: <path")])
patch('src/admin/Admin.jsx',[
 ("import Users from './Users'","import Users from './Users'\nimport Blog from './Blog'"),
 ("  { to: 'analytics', label: 'Analytics', icon: 'chart' },","  { to: 'blog', label: 'Blog', icon: 'pen' },\n  { to: 'analytics', label: 'Analytics', icon: 'chart' },"),
 ("  else if (route === 'content') page = <Content />","  else if (route === 'content') page = <Content />\n  else if (route === 'blog') page = <Blog seg={seg} navigate={navigate} me={session.user} key={seg[1] || 'list'} />"),
])
patch('src/admin/Log.jsx',[
 ("['content', 'Site content'], ['user', 'Users']]","['content', 'Site content'], ['blog', 'Blog'], ['user', 'Users']]"),
 ("user: 'bg-amber-400/20 text-amber-300' }","user: 'bg-amber-400/20 text-amber-300', blog: 'bg-emerald-400/20 text-emerald-300' }"),
])
print('ok')
