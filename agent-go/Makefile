BINARY_NAME=zoraxy-agent
VERSION=2.0.0
LDFLAGS=-s -w

.PHONY: build build-linux build-linux-arm build-all clean

build:
	go build -ldflags "$(LDFLAGS)" -o $(BINARY_NAME) .

build-linux:
	GOOS=linux GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o $(BINARY_NAME)-linux-amd64 .

build-linux-arm:
	GOOS=linux GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o $(BINARY_NAME)-linux-arm64 .

build-all: build-linux build-linux-arm
	@echo "Built all targets"

clean:
	rm -f $(BINARY_NAME) $(BINARY_NAME)-linux-amd64 $(BINARY_NAME)-linux-arm64
