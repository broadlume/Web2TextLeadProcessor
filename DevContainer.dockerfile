ARG TARGETPLATFORM

FROM node:23 AS node_base
# Install Bun
FROM oven/bun:1.2.10 AS base

# Install NodeJS 
COPY --from=node_base /usr/local/bin /usr/local/bin
COPY --from=node_base /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm
RUN apt-get update
RUN apt-get install -y curl xz-utils

# Install Restate CLI
RUN BIN=/usr/local/bin && RESTATE_PLATFORM=aarch64-unknown-linux-musl && RESTATE_VERSION=1.3.2 && \
curl -LO https://restate.gateway.scarf.sh/v$RESTATE_VERSION/restate-cli-$RESTATE_PLATFORM.tar.xz && \
ls && \
tar -xvf ./restate-cli-$RESTATE_PLATFORM.tar.xz --strip-components=1 restate-cli-$RESTATE_PLATFORM/restate && \
chmod +x restate && \

# Move the binaries to a directory in your PATH
mv restate $BIN

RUN mkdir -p /app
COPY . /app
WORKDIR /app
RUN bun install

