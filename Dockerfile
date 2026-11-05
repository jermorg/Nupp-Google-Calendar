FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./


RUN npm install --omit=dev

FROM node:20-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

RUN mkdir -p /app/data && chown -R node:node /app

COPY --from=builder /app/node_modules ./node_modules

COPY package*.json ./
COPY . .

USER node

CMD ["node", "index.js"]