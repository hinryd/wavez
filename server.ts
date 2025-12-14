// server.ts
const server = Bun.serve({
  port: 3000,
  fetch() {
    return new Response(Bun.file("build/index.html"));
  },
  error() {
    return new Response("404 Not Found", { status: 404 });
  },
});

console.log(`Listening on http://localhost:${server.port} at ${new Date().toISOString()}`);
