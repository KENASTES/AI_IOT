FROM node:22-bookworm
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "5173"]