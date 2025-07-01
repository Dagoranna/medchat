1. структура базы данных (визуализовано в файле schema.png)
1.1.Таблица пользователей (users)
    id
    name
    email
    password_hash 
    role — string( 'doctor', 'moderator', 'patient')
    created_at, updated_at 
    (здесь могут быть какие-то дополнительные поля для врачей 
    вроде специализации, в отпуске или нет, и т.д. )

1.2 Таблица чатов (chats)
    id
    status — string('bot_dialog', 'waiting_doctor', 'in_consultation', 'completed')
    patient_id — FK на users.id
    doctor_id — FK на users.id
    created_at, updated_at

1.3 Таблица сообщений (messages)
    id
    chat_id — FK на chats.id
    sender_id — FK на users.id
    text 
    sent_at 
    is_read 

Для тестов поднята такая база на supabase

2. WebSocket
    Поддерживает жизненный цикл чата и обмен сообщениями в реальном времени.
    Основные действия:
        userdata_request — сервер запрашивает данные пользователя при подключении.
        userdata — клиент отправляет email для идентификации.
        chat_start — создание нового чата, стартовый статус 'bot_dialog'.
        bot_approved — бот подтвердил начало чата, смена статуса на 'waiting_doctor'.
        doctor_assigned — назначение врача на чат, смена статуса на 'in_consultation', добавление doctor_id в данные чата
        chat_message — отправка сообщения в чат, рассылается всем кроме отправителя, сохраняется в базе.
        chat_close — завершение чата врачом, смена статуса на 'completed'.

3. POST /api/chat/loadchatlist (для теста - сконвертированный в чистый node аналог load_chat_list.js)
    Описание: Получить список чатов пользователя с возможностью фильтрации по статусу (например, активные чаты).
    Вход: JSON с полями email, password, filter (опционально).

    Логика:
        Проверить авторизацию пользователя (email и password).
        Получить пользователя из базы по email.
        В зависимости от роли пользователя (doctor, patient, moderator) выбирать чаты:
            doctor — чаты, где он назначен врачом;
            patient — чаты, где он пациентом;
            moderator — все чаты.
        Если указан фильтр, применить его (например, статус in_consultation для активных).

    Выход: JSON со списком чатов или ошибка с соответствующим статусом.

4. POST /api/chat/loadchatmessages (для теста - сконвертированный в чистый node аналог load_messages_list.js)
    Описание: Получить список сообщений по заданному чату.
    Вход: JSON с полями email, password, chat_id.

    Логика:
        Проверить авторизацию пользователя.
        Получить пользователя по email.
        Получить чат по chat_id.
        Проверить, что пользователь имеет право видеть этот чат (пациенту — совпадение patient_id, врачу — doctor_id, модератору — доступ всегда).
        Вернуть список сообщений из таблицы messages для данного чата.

    Выход: JSON со списком сообщений или ошибка.