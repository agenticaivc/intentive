# Use the official Node.js 18 LTS image
FROM node:18-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm@10.11.1

# Copy workspace configuration
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./

# Copy package.json files
COPY package.json ./
COPY packages/gateway/package.json ./packages/gateway/
COPY packages/nlp/package.json ./packages/nlp/
COPY packages/executor/package.json ./packages/executor/
COPY packages/tests/package.json ./packages/tests/
COPY packages/docs-website/package.json ./packages/docs-website/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the gateway service
RUN cd packages/gateway && rm -rf dist && pnpm run build

# Clean up dev dependencies to reduce image size
RUN pnpm install --frozen-lockfile --prod

# Expose the port
EXPOSE 4000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0
ENV USE_ROUTER_CONFIG=false

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4000/__health || exit 1

# Start the gateway service
CMD ["node", "packages/gateway/dist/server.js"] 