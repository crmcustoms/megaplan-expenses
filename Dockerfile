FROM node:18-alpine

WORKDIR /app

# Install git, docker CLI, and curl for webhook deployments and health checks
RUN apk add --no-cache git docker-cli curl

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
