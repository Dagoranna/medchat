const http = require("http");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/chats") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body);
        const { email, password, filter } = parsed;

        const authComplete = await checkAuth(email, password);
        if (!authComplete) {
          return sendJSON(res, 401, { message: "Authorization required" });
        }

        const user = await getUser(email);
        if (!user) {
          return sendJSON(res, 500, { message: "Database error" });
        }

        const chatList = await getChatList(user.id, user.role, filter);
        if (chatList === null) {
          return sendJSON(res, 500, { message: "Database error" });
        }

        return sendJSON(res, 200, { chats: chatList });
      } catch (err) {
        console.error("Request error:", err);
        return sendJSON(res, 400, { message: "Invalid request format" });
      }
    });
  } else {
    sendJSON(res, 404, { message: "Not Found" });
  }
});

server.listen(3000, () => {
  console.log("Server listening on http://localhost:3000");
});

// --- вспомогательные функции ---
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function checkAuth(email, password) {
  // Здесь можно реализовать проверку пароля
  return true; // заглушка
}

async function getUser(email) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email);

  if (error || !data || data.length === 0) {
    console.error("User lookup error:", error);
    return null;
  }

  return data[0];
}

async function getChatList(user_id, user_role, filter) {
  let query;

  switch (user_role) {
    case "doctor":
      query = supabase.from("chats").select("*").eq("doctor_id", user_id);
      break;
    case "patient":
      query = supabase.from("chats").select("*").eq("patient_id", user_id);
      break;
    case "moderator":
      query = supabase.from("chats").select("*");
      break;
    default:
      console.error("Unknown role:", user_role);
      return null;
  }

  if (filter === "active") {
    query = query.eq("status", "in_consultation");
  }

  const { data, error } = await query;
  if (error) {
    console.error("Chat list error:", error);
    return null;
  }

  return data;
}
