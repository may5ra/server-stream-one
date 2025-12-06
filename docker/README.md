# StreamPanel Docker Installation

## Quick Start

### 1. Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- Minimum 2GB RAM, 10GB disk space

### 2. Clone and Configure

```bash
# Clone repository
git clone https://github.com/your-repo/streampanel.git
cd streampanel/docker

# Copy and edit environment file
cp .env.example .env
nano .env

# IMPORTANT: Set your server IP/domain in .env:
# SERVER_DOMAIN=38.180.100.86
```

### 3. Start Services

```bash
# Start all services (without RTMP streaming)
docker-compose up -d

# Start with RTMP streaming server
docker-compose --profile streaming up -d
```

### 4. Access Panel

- **Panel URL**: http://your-server-ip
- **Default login**: admin@streampanel.local / admin123
- **API**: http://your-server-ip:3001

### 5. Xtream Codes API

Your IPTV apps can connect using:
- **Server**: http://your-server-ip
- **Username/Password**: Create streaming users in panel

API endpoints:
- `http://your-server-ip/player_api.php?username=USER&password=PASS`
- `http://your-server-ip/get.php?username=USER&password=PASS&type=m3u_plus`

## Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 80 | Web panel |
| Backend API | 3001 | REST API |
| PostgreSQL | 5432 | Database |
| RTMP | 1935 | Stream input (optional) |
| HLS | 8080 | Stream output (optional) |

## Commands

```bash
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart a service
docker-compose restart backend

# Update to latest version
git pull
docker-compose build --no-cache
docker-compose up -d

# Backup database
docker exec streampanel-db pg_dump -U streampanel streampanel > backup.sql

# Restore database
cat backup.sql | docker exec -i streampanel-db psql -U streampanel streampanel
```

## RTMP Streaming

To push a stream:
```bash
ffmpeg -re -i input.mp4 -c copy -f flv rtmp://your-server-ip:1935/live/streamkey
```

HLS output available at:
```
http://your-server-ip:8080/hls/streamkey.m3u8
```

## Production Checklist

- [ ] Change default passwords in `.env`
- [ ] Set up SSL/HTTPS (use nginx-proxy or Traefik)
- [ ] Configure firewall (allow only needed ports)
- [ ] Set up automated backups
- [ ] Monitor disk space for recordings
- [ ] Configure log rotation

## Troubleshooting

### Database connection failed
```bash
docker-compose logs db
docker-compose restart db
```

### Frontend not loading
```bash
docker-compose logs frontend
docker-compose build frontend --no-cache
docker-compose up -d frontend
```

### API errors
```bash
docker-compose logs backend
# Check database connection
docker exec streampanel-api node -e "require('pg').Pool({connectionString: process.env.DATABASE_URL}).query('SELECT 1')"
```
