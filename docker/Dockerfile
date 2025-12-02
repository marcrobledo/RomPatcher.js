FROM node:lts-slim

# Install unzip
RUN apt-get update && apt-get install -y unzip && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy everything from project root EXCEPT docker/ (using .dockerignore)
COPY . .
RUN npm install

# Explicitly copy entrypoint.sh from docker folder into root of container
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Volumes for input/output (host-mapped)
VOLUME ["/app/input", "/app/output"]

ENTRYPOINT ["/app/entrypoint.sh"]