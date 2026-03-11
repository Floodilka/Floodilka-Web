FROM node:24-bookworm-slim AS base

WORKDIR /usr/src/app

RUN corepack enable && corepack prepare pnpm@10.26.0 --activate

# Stage 1: Install ALL dependencies (including devDependencies for esbuild)
FROM base AS deps

RUN apt-get update && apt-get install -y --no-install-recommends \
		build-essential \
		gcc \
		libssl-dev \
		pkg-config \
		libvips-dev \
		libgomp1 \
		libatomic1 \
		python3 \
		make && \
	rm -rf /var/lib/apt/lists/*

COPY .npmrc package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build TypeScript → JavaScript with esbuild
FROM deps AS build

COPY tsconfig.json ./
COPY src ./src

RUN pnpm run build

# Stage 3: Production-only dependencies (no devDeps), strip non-linux binaries
FROM deps AS prod-deps

RUN pnpm install --frozen-lockfile --prod && \
	rm -rf node_modules/onnxruntime-node/bin/napi-v*/darwin \
		node_modules/onnxruntime-node/bin/napi-v*/win32

# Stage 4: Minimal runtime image
FROM node:24-bookworm-slim AS runtime

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends \
	curl \
	ffmpeg \
	libvips \
	libgomp1 \
	libatomic1 && \
	rm -rf /var/lib/apt/lists/*

COPY --chown=nobody:nogroup --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --chown=nobody:nogroup --from=build /usr/src/app/dist ./dist
COPY --chown=nobody:nogroup --from=build /usr/src/app/package.json .
COPY --chown=nobody:nogroup data/model.onnx /opt/data/model.onnx

USER nobody

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["node", "dist/App.js"]
