# Render deployment notes

## Keep disease and pest images between deploys

Render services without a persistent disk use an ephemeral filesystem. Attach a
persistent disk to the backend service, mount it at `/var/data`, and set this
environment variable on that service:

```text
UPLOAD_DIR=/var/data/uploads
```

The backend stores disease and pest images under this directory and serves them
at `/static/uploads/...`. Keep the mount path and `UPLOAD_DIR` setting unchanged
between deploys so existing image URLs continue to resolve. Images uploaded
before the disk is attached are not recovered automatically; their old URLs
will remain unavailable unless those files are restored to the disk.

The default upload directory remains `backend/data/uploads` for local
development.
