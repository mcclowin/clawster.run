FROM node:22-slim

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY dist/ ./dist/

ENV NODE_ENV=production
EXPOSE 3100

CMD ["node", "dist/server.js"]
