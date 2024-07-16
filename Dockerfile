ARG TARGETPLATFORM
# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:latest AS base
RUN mkdir -p /app
WORKDIR /app
COPY . /app
RUN apt-get update


