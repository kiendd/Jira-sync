FROM node:18-alpine AS builder
WORKDIR /app

# Install dependencies and build
COPY package*.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

# Runtime image
FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/index.js"]
