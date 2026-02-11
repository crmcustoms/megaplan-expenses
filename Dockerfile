FROM node:18-alpine

WORKDIR /app

# Install git and docker CLI for webhook deployments
RUN apk add --no-cache git docker-cli

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
