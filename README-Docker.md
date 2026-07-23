# Despliegue Docker - Contador Ganadero (VPS Ubuntu)

## Pasos iniciales

1. Copiar y editar el entorno de produccion:

```
cp .env.production.example .env && nano .env
```

Generar secretos con: `openssl rand -hex 32` (para JWT_SECRET, JWT_REFRESH_SECRET, EMAIL_ENC_KEY).

2. Construir y levantar todos los servicios:

```
docker-compose up -d --build
```

3. Ver logs en vivo:

```
docker-compose logs -f api
docker-compose logs -f worker-imap
```

## Let's Encrypt (certificado HTTPS inicial)

```
docker run --rm -v ./certbot/conf:/etc/letsencrypt -v ./certbot/www:/var/www/certbot certbot/certbot certonly --webroot -w /var/www/certbot --email admin@contadorganadero.com -d contadorganadero.com -d www.contadorganadero.com --agree-tos
```

Despues reiniciar nginx: `docker-compose restart nginx`.

## Operaciones utiles

- Backup Mongo: `docker-compose exec mongo mongodump --db contador_ganadero --out /backup`
- Restaurar Mongo: `docker-compose exec mongo mongorestore --db contador_ganadero /backup/contador_ganadero`
- Estado servicios: `docker-compose ps`
- Detener todo: `docker-compose down`  (datos persistentes en volumenes)
- Detener y borrar volumenes: `docker-compose down -v`
