const WebSocket = require("ws");

const ws = new WebSocket("ws://localhost:80");

const CHAT = {};

ws.on("open", () => {
  console.log("Connected to server");

  // Пример: отправляем запрос на userdata
  const userdataMsg = {
    action: "userdata",
    email: "patient1@test.com",
  };
  ws.send(JSON.stringify(userdataMsg));

  console.log("Create chat in 1 sec");
  setTimeout(() => {
    const chatStartMsg = {
      action: "chat_start",
      sender_id: 2,
    };
    ws.send(JSON.stringify(chatStartMsg));
  }, 1000);

  setTimeout(() => {
    console.log("Marking chat as complete in 15 sec after creation");
    const chatStartMsg = {
      action: "chat_close",
      sender_id: 1,
      chat_id: CHAT.chat_id,
    };
    ws.send(JSON.stringify(chatStartMsg));
  }, 15000);
});

ws.on("message", (data) => {
  const dataStr = data.toString();
  console.log("Received:", dataStr);
  const dataJSON = JSON.parse(dataStr);
  if (dataJSON.action === "chat_start" && dataJSON.data) {
    CHAT["chat_id"] = dataJSON.data;
    console.log("Approve chat (as with bot) in 3 sec");
    // Через 3 секунды после создания проаппрувим чат ботом
    setTimeout(() => {
      const chatStartMsg = {
        action: "bot_approved",
        chat_id: dataJSON.data,
      };
      ws.send(JSON.stringify(chatStartMsg));
    }, 3000);
  }
  if (dataJSON.action === "bot_approved" && dataJSON.data) {
    console.log("Assign chat to a doctor in 3 sec");
    // Через 3 секунды после аппрува примем чат на доктора 1
    setTimeout(() => {
      const chatStartMsg = {
        action: "doctor_assigned",
        chat_id: dataJSON.data,
        sender_id: 1,
      };
      ws.send(JSON.stringify(chatStartMsg));
    }, 3000);
  }
  if (dataJSON.action === "doctor_assigned" && dataJSON.data) {
    console.log("Send message in 3 sec after assigning");
    // Через 3 секунды после подписки доктора отсылаем сообщение
    setTimeout(() => {
      const chatStartMsg = {
        action: "chat_message",
        chat_id: dataJSON.data.chat_id,
        sender_id: 2,
        message: "hello!",
      };
      ws.send(JSON.stringify(chatStartMsg));
    }, 3000);
  }
});

ws.on("close", () => {
  console.log("Connection closed");
});

ws.on("error", (err) => {
  console.error("Error:", err);
});
