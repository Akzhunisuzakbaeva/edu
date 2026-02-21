# Internetke Publish (Django + React)

## 0) Repo already prepared

Added files:
- `render.yaml` (Render backend + Postgres blueprint)
- `server/requirements.txt`
- `server/.env.example`
- `server/frontend/.env.example`
- `server/frontend/vercel.json` (SPA rewrite)

## 1) Backend (Render)

Service settings:
- `Environment`: `Python`
- `Root directory`: `server`
- `Build command`:
  - `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
- `Start command`:
  - `gunicorn edu_platform.wsgi:application --bind 0.0.0.0:$PORT`

Environment variables:
- `DJANGO_SECRET_KEY` = long random secret
- `DEBUG` = `False`
- `ALLOWED_HOSTS` = `your-backend.onrender.com`
- `FRONTEND_URL` = `https://your-frontend.vercel.app`
- `CORS_ALLOW_ALL_ORIGINS` = `False`
- `CORS_ALLOWED_ORIGINS` = `https://your-frontend.vercel.app`
- `CSRF_TRUSTED_ORIGINS` = `https://your-frontend.vercel.app`
- `DATABASE_URL` = Render Postgres connection string
- `DATABASE_SSL_REQUIRE` = `True`

After deploy:
- open: `https://your-backend.onrender.com/admin/`
- open: `https://your-backend.onrender.com/api/slide/health/`

## 2) Frontend (Vercel or Netlify)

Service settings:
- `Root directory`: `server/frontend`
- `Build command`: `npm ci && npm run build`
- `Output directory`: `dist`

Environment variable:
- `VITE_API_URL` = `https://your-backend.onrender.com/api`

Vercel project settings:
- Framework: `Vite`
- Root Directory: `server/frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

## 3) Verify

1. Frontend ашыңыз: `https://your-frontend.vercel.app`
2. Login жасап көріңіз.
3. Quiz, Lessons, Analytics, Live беттері API-ға қосылғанын тексеріңіз.
4. Admin бетте қолданушы/дерек барын тексеріңіз.

## 4) Common fixes

- `CORS error`: `CORS_ALLOWED_ORIGINS` және `VITE_API_URL` дұрыс па тексеріңіз.
- `DisallowedHost`: `ALLOWED_HOSTS`-қа backend доменін қосыңыз.
- `CSRF failed`: `CSRF_TRUSTED_ORIGINS`-қа frontend доменін қосыңыз.
- `Static files`: build command ішінде `collectstatic` бар болуы керек.
