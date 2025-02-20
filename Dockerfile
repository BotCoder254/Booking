# Use Node.js LTS version
FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies with clean cache and production only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy app source
COPY . .

# Set default environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    MONGODB_URI=mongodb+srv://telvin:soulmind@cluster0.k9y9n.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0 \
    SESSION_SECRET=cab74f2d1f37a208fd9e6b2e3249f8625fe3a84b31bc7287d2f5c9ac8b48bda9 \
    SMTP_HOST=smtp.gmail.com \
    SMTP_PORT=587 \
    SMTP_USER=teumteum776@gmail.com \
    SMTP_PASS="pcim cpkc mnsc rqwv" \
    ADMIN_EMAIL=admin@eventsys.com \
    EMAIL_FROM_NAME=EventSys \
    EMAIL_FROM_ADDRESS=noreply@eventsys.com

# Set base URL based on environment
ENV BASE_URL=${RENDER_EXTERNAL_URL:+https://$RENDER_EXTERNAL_URL}
ENV BASE_URL=${BASE_URL:-http://localhost:$PORT}

# Expose port
EXPOSE ${PORT}

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/ || exit 1

# Create data directory for MongoDB (if needed)
RUN mkdir -p /data/db

# Add script to wait for MongoDB
COPY wait-for-mongo.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/wait-for-mongo.sh

# Start the application with proper env loading
CMD ["sh", "-c", "node -r dotenv/config app.js"] 