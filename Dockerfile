FROM node:24 AS build

WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.29

COPY --from=build /src/dist/ /usr/share/nginx/html
