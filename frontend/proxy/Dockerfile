FROM golang:1.25.5-alpine AS build

WORKDIR /build

COPY floodilka_app/proxy/go.mod ./
COPY floodilka_app/proxy/go.sum* ./
RUN go mod download

COPY floodilka_app/proxy/ .

COPY floodilka_app/dist/index.html assets/index.html
COPY floodilka_app/dist/manifest.json assets/manifest.json
COPY floodilka_app/dist/sw.js* assets/
COPY floodilka_app/dist/version.json assets/version.json

ARG TARGETOS=linux
ARG TARGETARCH=amd64
RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -o floodilka-app-proxy

FROM alpine:3.19

RUN apk add --no-cache ca-certificates curl

WORKDIR /app

COPY --from=build /build/floodilka-app-proxy /app/floodilka-app-proxy

USER nobody

EXPOSE 8080
ENV PORT=8080

ENTRYPOINT ["/app/floodilka-app-proxy"]
