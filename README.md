Установка:
Для работы сервера нужны node.js + библиотеки:
"@supabase/supabase-js", "dotenv", "ws"

Они устанавливаются: 
npm install @supabase/supabase-js dotenv ws

Файл .env.local (с ключами от  supabase) добавлен в проект, чтобы у тестов был доступ к базе

Команды для запуска: 
1)ws-сервер:
npm run server

2)тестовый ws-клиент
npm run testws

3)запуск эндпойнтов, сконвертированных из роутов Next.js (для тестирования загрузки чатов и сообщений):
npm run chatlist
npm run messagelist

4)тест загрузки чатов/сообщений:
npm run textload


