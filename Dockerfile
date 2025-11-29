FROM node:24.11.1 AS buildbase

RUN npm install -g pnpm


FROM buildbase AS build

COPY package.json pnpm-lock.yaml tsconfig.json tsconfig.app.json tsconfig.node.json eslint.config.js vite.config.ts index.html /app/
COPY src /app/src/

WORKDIR /app

RUN pnpm install
RUN pnpm build


FROM docker.io/library/caddy:2.10.2-alpine

COPY --from=build /app/dist /usr/share/caddy
