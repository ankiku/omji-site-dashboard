# Stage 1: Build the Vite Frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Setup the Express Backend
FROM node:20-alpine
WORKDIR /app

# Copy the backend files
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --production

COPY server/ ./
# Copy the built frontend from Stage 1 into the /app/dist directory
COPY --from=build /app/dist /app/dist

# Ensure the required directories exist
RUN mkdir -p /app/server/data /app/server/public/uploads

EXPOSE 5000
CMD ["npm", "start"]
