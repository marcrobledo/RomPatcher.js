# Docker Setup for RomPatcher.js

## Overview

This Docker setup allows you to patch ROM files using RomPatcher.js inside a container.  
- Input ROMs and patch files go in the `docker/input` folder.  
- Patched ROMs are saved to `docker/output`.  
- ZIP patch files are automatically extracted if needed.

Everything runs inside a Node.js container; no Node installation is required on your host.

---

## Folder Structure

```
project-root/
└── docker/
  ├── .gitignore # Exclude input/output folder content
  ├── .dockerignore # Exclude unnecessary files from image build
  ├── docker-compose.yml # Docker Compose setup
  ├── Dockerfile # Docker image definition
  ├── entrypoint.sh # Script that applies patches
  ├── input/ # ROMs + patches (mounted as volume)
  └── output/ # Patched ROMs (mounted as volume)
```

- `docker/input` and `docker/output` are **volumes** - files here are visible on the host.  

---

## Docker Build & Run

### Build & Run the image

From inside the `docker/` folder:

```bash
docker-compose up --build
```

- Patches all ROMs in `docker/input`.

- Output files are saved to `docker/output`.

## Example Usage

1. Put `MyGame.v64` in `docker/input`.

2. Put patches (`*.bps` or `*.zip`) in `docker/input`.

3. Build and run:
```bash
cd docker
docker-compose up --build
```
4. Patched ROMs appear in `docker/output`