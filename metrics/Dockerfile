FROM rustlang/rust:nightly-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml ./

RUN mkdir -p src && echo "fn main() {}" > src/main.rs

RUN cargo build --release 2>/dev/null || true

RUN rm -rf src

COPY src ./src

RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/floodilka_metrics /app/floodilka_metrics

RUN useradd -r -s /bin/false floodilka
USER floodilka

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/_health || exit 1

EXPOSE 8080

CMD ["/app/floodilka_metrics"]
