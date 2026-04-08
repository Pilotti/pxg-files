FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* yarn.lock* ./ 

# Install dependencies
RUN npm install

# Copy application
COPY . .

# Build Next.js
RUN npm run build

# Railway injects PORT dynamically; Next must bind to all interfaces.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Expose default port for local/docker use.
EXPOSE 3000

# Run Next.js
CMD ["sh", "-c", "npm run start -- -H 0.0.0.0 -p ${PORT}"]
