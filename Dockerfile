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

# Copy app source and env file
COPY . .

# Set default environment variables (will be overridden by .env file)
ENV NODE_ENV=production \
    PORT=3000 \
    MONGODB_URI=mongodb+srv://telvin:soulmind@cluster0.k9y9n.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0 \
    SESSION_SECRET=your_session_secret_here \
    MPESA_CONSUMER_KEY=lo3ulMVG5tf2GUnvtJrE80TFsQblCdApm0EhN4QBCAg4Jwuk \
    MPESA_CONSUMER_SECRET=OO7GuqeGLt3hXMW8eqNrDFjGqgFPKT8IE2ogdrcy5vDCfJppVEZwk157AOlplAgK \
    MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919 \
    MPESA_SHORTCODE=174379 \
    MPESA_ENVIRONMENT=sandbox \
    MPESA_TEST_MSISDN=254792052669 \
    MPESA_TEST_PHONE=254792052669 \
    SMTP_HOST=smtp.gmail.com \
    SMTP_PORT=587 \
    SMTP_USER=teumteum776@gmail.com \
    SMTP_PASS="calz oyxv inlj msgv" \
    ADMIN_EMAIL=admin@eventsys.com \
    EMAIL_FROM_NAME=EventSys \
    EMAIL_FROM_ADDRESS=noreply@eventsys.com \
    RENDER_EXTERNAL_URL=your-app-name.onrender.com \
    RENDER_EXTERNAL_HOSTNAME=your-app-name.onrender.com

# Set base URL using RENDER_EXTERNAL_URL if available
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

# Start the application using node with env file
CMD ["sh", "-c", "node -r dotenv/config app.js"] 