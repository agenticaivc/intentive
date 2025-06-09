# Railway Deployment Guide for Intentive

## Quick Deploy

1. **Connect to Railway**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   ```

2. **Deploy from GitHub**
   - Go to [Railway](https://railway.app)
   - Click "Deploy from GitHub repo"
   - Select your Intentive repository
   - Railway will automatically detect the `Dockerfile` and `railway.toml`

3. **Set Environment Variables**
   In the Railway dashboard, add these environment variables as needed:
   
   **Required for OpenAI functionality:**
   - `OPENAI_API_KEY`: Your OpenAI API key
   
   **Optional configurations:**
   - `REDIS_URL`: Redis connection string (for persistent storage)
   - `GRAPHQL_ENDPOINT`: GraphQL endpoint URL
   - `USE_ROUTER_CONFIG`: Set to "true" to enable YAML-driven routes
   - `STORE_DRIVER`: "redis" or "memory" (default: memory)
   - `EXECUTION_TTL_DAYS`: Execution data retention days (default: 7)

4. **Custom Domain (Optional)**
   - In Railway dashboard, go to Settings → Domains
   - Add your custom domain
   - Update DNS records as instructed

## Application Details

- **Port**: 4000 (automatically configured)
- **Health Check**: `/__health` endpoint
- **Build**: Uses Dockerfile with PNPM monorepo setup
- **Service**: Fastify-based API gateway

## Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | production | ✅ |
| `PORT` | Server port | 4000 | ✅ |
| `HOST` | Server host | 0.0.0.0 | ✅ |
| `LOG_LEVEL` | Logging level | info | ✅ |
| `OPENAI_API_KEY` | OpenAI API key | - | For NLP features |
| `REDIS_URL` | Redis connection | - | For persistence |
| `GRAPHQL_ENDPOINT` | GraphQL endpoint | - | For GraphQL fallback |
| `USE_ROUTER_CONFIG` | Enable YAML routes | true | Optional |

## Troubleshooting

- **Build fails**: Check that all package.json files are properly copied
- **Health check fails**: Verify the `/__health` endpoint is accessible
- **NLP features not working**: Ensure `OPENAI_API_KEY` is set
- **Memory issues**: Consider adding Redis with `REDIS_URL` and `STORE_DRIVER=redis`

## Local Testing

Test the Docker build locally:
```bash
# Build the image
docker build -t intentive .

# Run the container
docker run -p 4000:4000 -e OPENAI_API_KEY=your_key_here intentive

# Test health endpoint
curl http://localhost:4000/__health
``` 