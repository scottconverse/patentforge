FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Use PostgreSQL schema for Docker builds (local dev uses SQLite schema.prisma)
RUN cp prisma/schema.postgres.prisma prisma/schema.prisma
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
# prisma db push applies schema directly (avoids SQLite-format migration files)
# node dist/main used directly — env vars provided by docker-compose, no .env file needed
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/main"]
