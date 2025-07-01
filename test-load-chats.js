const http = require("http");

const postData = JSON.stringify({
  email: "doctor1@test.com",
  password: "1234",
});

const optionsChats = {
  hostname: "localhost",
  port: 3000,
  path: "/chats",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(postData),
  },
};

function requestChats() {
  return new Promise((resolve, reject) => {
    const req = http.request(optionsChats, (res) => {
      let data = "";

      console.log(`Status (chats): ${res.statusCode}`);

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          console.log("Chats response parsed:", parsed);
          resolve(parsed);
        } catch (err) {
          reject(new Error("Failed to parse chats response"));
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

function requestMessages(chat_id) {
  return new Promise((resolve, reject) => {
    const postDataMessages = JSON.stringify({
      email: "doctor1@test.com",
      password: "1234",
      chat_id,
    });

    const optionsMessages = {
      hostname: "localhost",
      port: 3001,
      path: "/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postDataMessages),
      },
    };

    const req = http.request(optionsMessages, (res) => {
      let data = "";

      console.log(`Status (messages): ${res.statusCode}`);

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          console.log("Messages response parsed:", parsed);
          resolve(parsed);
        } catch (err) {
          reject(new Error("Failed to parse messages response"));
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(postDataMessages);
    req.end();
  });
}

(async () => {
  try {
    const chatsResp = await requestChats();
    if (!chatsResp.chats || chatsResp.chats.length === 0) {
      console.log("No chats found");
      return;
    }

    const firstChatId = chatsResp.chats[0].id;
    console.log("First chat id:", firstChatId);

    const messagesResp = await requestMessages(firstChatId);
    console.log("Messages for chat:", messagesResp.messages);
  } catch (err) {
    console.error("Error in test:", err);
  }
})();
