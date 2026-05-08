FROM oven/bun:1.3.9-debian AS build

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1.3.9-debian

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    curl \
    iproute2 \
    iputils-ping \
    postgresql-client \
    procps \
    util-linux \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
ENV LAB_DATA_DIR=/app/data

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/src/server ./src/server
COPY --from=build /app/src/lib/types ./src/lib/types

RUN mkdir -p /app/data && chmod -R 777 /app/data

EXPOSE 8080

CMD ["bun", "server.ts"]
