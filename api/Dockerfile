FROM node:20-slim

WORKDIR /app

# Install dependencies for better-sqlite3 native build
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create data directory for SQLite
RUN mkdir -p /data

# Expose port (Azure Container Apps uses 80 by default)
ENV PORT=80
EXPOSE 80

# Start the server
CMD ["node", "src/server.js"]
