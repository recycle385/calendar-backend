# 1단계: 빌드 환경
FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
# npm을 사용하여 의존성 설치
RUN npm install
COPY . .
RUN npm run build

# 2단계: 프로덕션 환경
FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY --from=builder /usr/src/app/dist ./dist
EXPOSE ${PORT:-3000}
CMD [ "node", "dist/src/web.js" ]