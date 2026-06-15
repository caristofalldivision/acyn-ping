BINARY := ping-agent
VERSION := 0.2.0
LDFLAGS := -s -w -X main.version=$(VERSION)
DIST := dist

.PHONY: all clean linux darwin windows checksums

all: linux darwin windows checksums

clean:
	rm -rf $(DIST)
	mkdir -p $(DIST)

linux:
	GOOS=linux  GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o $(DIST)/$(BINARY)-linux-amd64 .
	GOOS=linux  GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o $(DIST)/$(BINARY)-linux-arm64 .

darwin:
	GOOS=darwin GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o $(DIST)/$(BINARY)-darwin-amd64 .
	GOOS=darwin GOARCH=arm64 go build -ldflags="$(LDFLAGS)" -o $(DIST)/$(BINARY)-darwin-arm64 .

windows:
	GOOS=windows GOARCH=amd64 go build -ldflags="$(LDFLAGS)" -o $(DIST)/$(BINARY)-windows-amd64.exe .

checksums:
	cd $(DIST) && sha256sum * > SHA256SUMS

dev:
	go build -o $(BINARY) .
	./$(BINARY) run

vet:
	go vet ./...
