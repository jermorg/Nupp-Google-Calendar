FROM node:20-alpine

ENV NODE_ENV=production

WORKDIR /app

RUN mkdir -p /app/data && chown -R node:node /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

USER node

CMD ["node", "index.js"]