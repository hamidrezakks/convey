FROM golang:1.27.1-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/gateway ./cmd/gateway

FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /out/gateway /usr/local/bin/gateway
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/gateway"]
