import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'

const app = new Hono()

app.use('/*', serveStatic({ root: './build' }));
app.get('/', serveStatic({ path: './build/index.html' }));


export default app