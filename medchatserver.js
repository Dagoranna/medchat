const WebSocket = require("ws");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local" });

const { createClient } = require("@supabase/supabase-js");

const PORT = process.env.PORT || 80;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const wss = new WebSocket.Server({ port: PORT });

const users = new Set();
const usersData = new Map();

function sendToChatPartnersExceptMe(ws, messageJSON) {
  let currentChat = messageJSON.chat_id;
  users.forEach((client) => {
    let clientData = usersData.get(client);
    if (clientData && clientData.chatId === currentChat && ws !== client) {
      client.send(JSON.stringify(messageJSON));
    }
  });
}

/*структура базы данных
1) Таблица пользователей (users)
    id
    name
    email
    password_hash 
    role — ENUM: 'doctor', 'moderator', 'patient'
    created_at, updated_at 

    + какие-то дополнительные поля для врачей 
    вроде специализации, в отпуске или нет, и т.д. 
2) Таблица чатов (chats)
    id
    status — ENUM: 'bot_dialog', 'waiting_doctor', 'in_consultation', 'completed'
    patient_id — FK на users.id
    doctor_id — FK на users.id
    created_at, updated_at

3) Таблица сообщений (messages)
    id
    chat_id — FK на chats.id
    sender_id — FK на users.id
    text 
    sent_at 
    is_read 
*/

/*структура сообщения 
  {
  "chat_id": "id чата",
  "sender_id": "id пользователя",
  "action": "chat_start | userdata | chat_message | bot_approved | doctor_assigned | chat_close", 
(+ другие действия, например по модерированию, chat_delete | message_delete")
  "message": "текст сообщения, если есть",
  "metadata": { дополнительные данные на будущее: message_id, reply_to, attachments и т.д.  }
*/

wss.on("connection", (ws) => {
  users.add(ws);

  ws.send(JSON.stringify({ action: "userdata_request" }));
  //по этому запросу клиентская часть должна сообщить идентификацию пользователя
  //через сообщение с action: "userdata"

  ws.isAlive = true;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  const interval = setInterval(() => {
    if (!ws.isAlive) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  }, 30000);

  // ----------- message -------------
  ws.on("message", async (message) => {
    let messageJSON = {};
    const responseJSON = {};

    try {
      messageJSON = JSON.parse(message);
    } catch (err) {
      console.error("Invalid JSON:", err);
      responseJSON["error"] = "Invalid JSON format";
      ws.send(JSON.stringify(responseJSON));
      return;
    }

    responseJSON["action"] = messageJSON.action;

    switch (messageJSON.action) {
      case "chat_start":
        let chatId = await createChat(messageJSON.sender_id);
        if (chatId === null) {
          responseJSON["error"] = "database error on chat creation";
        } else {
          responseJSON["data"] = chatId;
          usersData.set(ws, {
            ...(usersData.get(ws) || {}),
            chatId,
          });
        }
        break;
      case "userdata":
        let patientId = await patientDataActualization(messageJSON.email);
        if (patientId === null) {
          responseJSON["error"] = "database error in get patient data";
        } else {
          responseJSON["data"] = patientId;
        }
        usersData.set(ws, { id: patientId });
        break;
      case "bot_approved":
        //TODO: тут должны быть какие-то проверки, что сообщение действительно от бота
        let statusApproved = await chatStatusChanging(
          messageJSON.chat_id,
          "waiting_doctor"
        );
        if (!statusApproved) {
          responseJSON["error"] = "database error on chat status changing";
        } else {
          responseJSON["data"] = messageJSON.chat_id;
          await callForDoctor(messageJSON.chat_id);
        }
        break;
      case "doctor_assigned":
        let doctorAssigned = await doctorAssigning(
          messageJSON.chat_id,
          messageJSON.sender_id
        );
        if (!doctorAssigned) {
          responseJSON["error"] = "database error on doctor assigning";
        } else {
          responseJSON["data"] = {
            doctor: messageJSON.sender_id,
            chat_id: messageJSON.chat_id,
          };
        }
        //TODO: какое-то уведомление пациенту, желательно не только в чат,
        //но и на фронт (например, всплывающее окно)
        break;
      case "chat_message":
        let chatAvailable = await isChatAvailable(
          messageJSON.chat_id,
          messageJSON.sender_id
        );
        if (!chatAvailable) {
          responseJSON["error"] = "chat is not available";
          break;
        }
        sendToChatPartnersExceptMe(ws, messageJSON);
        let messageSaved = await saveMessageToDatabase(messageJSON);
        if (!messageSaved) {
          responseJSON["error"] = "database error on message saving";
        } else {
          responseJSON["data"] = true;
        }
        break;
      case "chat_close":
        let checkChatDoctor = await isDoctorCorrect(
          messageJSON.chat_id,
          messageJSON.doctor_id
        );
        if (!checkChatDoctor) {
          responseJSON["error"] =
            "You do not have permission to perform this action";
        }

        let statusClosed = await chatStatusChanging(
          messageJSON.chat_id,
          "completed"
        );
        if (!statusClosed) {
          responseJSON["error"] = "database error on chat status changing";
        } else {
          responseJSON["data"] = true;
          usersData.delete(ws);
        }
        break;
      default:
        responseJSON["error"] = "unknown action type";
    }

    ws.send(JSON.stringify(responseJSON));
  });

  ws.on("close", () => {
    clearInterval(interval);
    users.delete(ws);
    usersData.delete(ws);
  });
});

async function createChat(patient_id) {
  const { data, error } = await supabase
    .from("chats")
    .insert([{ status: "bot_dialog", patient_id }])
    .select("id");

  if (error) {
    console.error("Error:", error);
    return null;
  }

  //у supabase бывают проблемы с single, поэтому через массив
  if (data && data.length > 0) {
    return data[0].id;
  }

  return null;
}

async function patientDataActualization(email) {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("email", email);

  /*TODO: В реальном проекте с авторизацией сюда передаем кроме мэйла 
  и хэш пароля, и проверяем авторизацию*/

  if (error) {
    console.error("Error:", error);
    return null;
  }

  if (data && data.length > 0) {
    return data[0].id;
  } else {
    //может быть только если недогрузился запрос,
    //т.к. если авторизация пройдена то данные пациента есть
    return null;
  }
}

async function isChatAvailable(chat_id, sender_id) {
  let data, error;
  ({ data, error } = await supabase
    .from("chats")
    .select("status")
    .eq("id", chat_id));

  if (error) {
    console.error("Error:", error_chat);
    return null;
  } else {
    if (!data || data.length === 0) {
      console.error("Chat not found or empty");
      return false;
    }

    if (data[0].status === "completed") {
      ({ data, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", sender_id));

      if (error) {
        console.error("Error:", error_user);
        return null;
      }
      if (!data || data.length === 0) {
        console.error("Sender not found or empty");
        return false;
      }
      if (data[0].role === "patient") {
        return false;
      } else {
        return true;
      }
    } else {
      return true;
    }
  }
}

async function isDoctorCorrect(chat_id, doctor_id) {
  const { data, error } = await supabase
    .from("chats")
    .select("doctor_id")
    .eq("id", chat_id);

  if (error) {
    console.error("Error:", error);
    return false;
  } else {
    if (data.doctor_id === doctor_id) {
      return true;
    } else {
      return false;
    }
  }
}

async function saveMessageToDatabase(messageJSON) {
  const { data, error } = await supabase.from("messages").insert([
    {
      chat_id: messageJSON.chat_id,
      sender_id: messageJSON.sender_id,
      is_read: false,
      text: messageJSON.message,
    },
  ]);

  if (error) {
    console.error("Error:", error);
    return null;
  } else {
    return true;
  }
}

async function chatStatusChanging(chat_id, new_status) {
  const { error } = await supabase
    .from("chats")
    .update({ status: new_status })
    .eq("id", chat_id);

  if (error) {
    console.error("Error:", error);
    return false;
  } else {
    return true;
  }
}

async function doctorAssigning(chat_id, sender_id) {
  const { error } = await supabase
    .from("chats")
    .update({ status: "in_consultation", doctor_id: sender_id })
    .eq("id", chat_id);

  if (error) {
    console.error("Error:", error);
    return false;
  } else {
    return true;
  }
}

async function callForDoctor(chatId) {
  /*TODO:
  рассылка врачам что появился новый пациент,
  с логикой выбора на основе данных, собранных чатботом,
  и дополнительных параметров самих врачей 
  */
}
