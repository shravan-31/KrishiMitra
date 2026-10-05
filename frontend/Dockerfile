FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Default command (overridden in docker-compose)
CMD ["npm", "run", "dev", "--", "--host"]
