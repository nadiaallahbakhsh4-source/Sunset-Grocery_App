# ==========================================
# STAGE 1: Build the frontend application
# ==========================================
FROM node:22-alpine AS build-stage

WORKDIR /app

# ---- ADD THESE TWO LINES HERE ----
ARG VITE_GEMINI_API_KEY
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY
# ----------------------------------

# Copy dependency files first to speed up subsequent builds
COPY package*.json ./

# Install your dependencies (the 2815 modules from your logs)
RUN npm install

# Copy all your project source code files
COPY . .

# Run the Vite build command to generate the fresh /dist folder
RUN npm run build

# ==========================================
# STAGE 2: Serve the application with Nginx
# ==========================================
FROM nginx:alpine

# Copy the built files directly from the build-stage above
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Expose and configure port 8080 for Cloud Run
EXPOSE 8080
RUN sed -i 's/listen\(.*\)80;/listen 8080;/g' /etc/nginx/conf.d/default.conf && \
    sed -i 's/try_files \$uri \$uri\/ =404;/try_files \$uri \$uri\/ \/index.html;/g' /etc/nginx/conf.d/default.conf

CMD ["nginx", "-g", "daemon off;"]