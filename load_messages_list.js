const http = require("http");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/messages") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const { email, password, chat_id } = JSON.parse(body);

        const authComplete = await checkAuth(email, password);
        if (!authComplete) {
          return sendJSON(res, 401, { message: "Authorization required" });
        }

        const user = await getUser(email);
        if (!user) {
          return sendJSON(res, 500, { message: "Database error" });
        }

        const chat = await getChatById(chat_id);
        if (!chat) {
          return sendJSON(res, 500, { message: "Database error" });
        }

        // Access check
        switch (user.role) {
          case "patient":
            if (user.id !== chat.patient_id) {
              return sendJSON(res, 403, { message: "Forbidden" });
            }
            break;
          case "doctor":
            if (user.id !== chat.doctor_id) {
              return sendJSON(res, 403, { message: "Forbidden" });
            }
            break;
          case "moderator":
            break;
          default:
            return sendJSON(res, 400, { message: "No such role" });
        }

        const messageList = await getMessageList(chat.id);
        if (!messageList) {
          return sendJSON(res, 500, { message: "Database error" });
        }

        return sendJSON(res, 200, { messages: messageList });
      } catch (err) {
        console.error("Parsing error:", err);
        return sendJSON(res, 400, { message: "Invalid request body" });
      }
    });
  } else {
    sendJSON(res, 404, { message: "Not found" });
  }
});

server.listen(3001, () => {
  console.log("Server listening on http://localhost:3001/messages");
});

// --- Вспомогательные функции ---

function sendJSON(res, statusCode, obj) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

async function checkAuth(email, password) {
  // Заглушка
  return true;
}

async function getUser(email) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email);

  if (error || !data || data.length === 0) {
    console.error("getUser error:", error);
    return null;
  }

  return data[0];
}

async function getChatById(chat_id) {
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("id", chat_id);

  if (error || !data || data.length === 0) {
    console.error("getChatById error:", error);
    return null;
  }

  return data[0];
}

async function getMessageList(chat_id) {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chat_id);

  if (error) {
    console.error("getMessageList error:", error);
    return null;
  }

  return data;
}
