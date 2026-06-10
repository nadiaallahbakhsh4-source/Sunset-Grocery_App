# Step 1: Use a lightweight web server to serve the static files
FROM nginx:alpine

# Step 2: Copy the built files from your local dist folder to the nginx server
COPY dist /usr/share/nginx/html

# Step 3: Expose port 8080 (Cloud Run's default required port)
EXPOSE 8080

# Step 4: Configure Nginx to run on port 8080 instead of the default 80
RUN sed -i 's/listen\(.*\)80;/listen 8080;/g' /etc/nginx/conf.d/default.conf

# Step 5: Start Nginx
CMD ["nginx", "-g", "daemon off;"]