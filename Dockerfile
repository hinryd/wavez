FROM oven/bun:slim AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN bun install

COPY . .
RUN bun run build

FROM oven/bun:slim

WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["bun", "./build/index.html"]
