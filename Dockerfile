# ==========================================
# Build Stage
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency configuration files
COPY package.json package-lock.json* ./

# Install dependencies robustly
RUN npm install --legacy-peer-deps

# Copy application source code
COPY . .

# Build the Single Page Application (SPA) - output to /app/dist
RUN npm run build

# ==========================================
# Production Stage
# ==========================================
FROM nginx:alpine

# Copy the custom Nginx configuration for correct SPA routing/caching
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from build stage to Nginx directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 8080 (Google Cloud Run default port is 8080)
EXPOSE 8080

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]