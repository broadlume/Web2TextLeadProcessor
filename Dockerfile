ARG TARGETPLATFORM

FROM node:23 AS node_base
# Install Bun
FROM oven/bun:1.2 AS base

# Install NodeJS 
COPY --from=node_base /usr/local/bin /usr/local/bin
COPY --from=node_base /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/npm

RUN mkdir -p /app
COPY . /app
WORKDIR /app
RUN bun install
RUN apt-get update
