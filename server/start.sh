#!/bin/bash

echo "🚀 Django серверін іске қосу..."
source venv/bin/activate
python manage.py runserver &
DJANGO_PID=$!

echo "⚙️ Frontend серверін іске қосу..."
cd frontend
npm run dev -- --host 0.0.0.0 --port 5174 &
FRONT_PID=$!

echo "✅ Екі сервер де жұмыс істеп тұр!"
echo "Django → http://127.0.0.1:8000/"
echo "Frontend → http://localhost:5174/"
echo "Болдырмау үшін: kill $DJANGO_PID $FRONT_PID"
wait
