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
# NOTE: --accept-data-loss was removed intentionally. If schema changes would
# drop columns or tables, the push will fail and require explicit action.
CMD ["sh", "-c", "npx prisma db push && node --enable-source-maps dist/main"]
