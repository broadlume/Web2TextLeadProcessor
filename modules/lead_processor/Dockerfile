# syntax=docker/dockerfile:1.7-labs
# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1.2.10 AS base
RUN mkdir -p /app
WORKDIR /app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
# Copy shared monorepo packages
COPY package.json bun.lock /temp/dev/
# Copy module packages
COPY --parents modules/*/package.json /temp/dev/
# Copy shared monorepo package patches
COPY patches/ /temp/dev/patches/
# Copy module package patches
COPY --parents modules/*/patches /temp/dev/
RUN ls /temp/dev/modules && cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
# Copy shared monorepo packages
COPY package.json bun.lock /temp/prod/
# Copy module packages
COPY --parents modules/*/package.json /temp/prod/
# Copy shared monorepo package patches
COPY patches/ /temp/prod/patches/
# Copy module package patches
COPY --parents modules/*/patches/ /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY --parents --from=install /temp/dev/modules/* modules
COPY . .

# check & build
ENV NODE_ENV=production
RUN bun run check && cd modules/lead_processor && bun run bundle

# copy production dependencies and source code into final image
FROM node:slim AS release
COPY --from=install /temp/prod/node_modules node_modules
COPY --from=install /temp/prod/modules/ modules/
COPY --from=prerelease /app/modules/lead_processor/dist modules/lead_processor/dist

COPY --from=prerelease /app/package.json .
COPY --parents --from=prerelease /app/modules/*/package.json .


# run the app
EXPOSE 9080/tcp
ENV NODE_ENV=production
ENTRYPOINT ["node","--enable-source-maps","./modules/lead_processor/dist/app.js"]
