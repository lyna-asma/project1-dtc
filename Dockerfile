FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx drizzle-kit migrate && node src/scripts/seed-admin.js && node src/index.js"]

