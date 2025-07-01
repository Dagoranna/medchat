import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export async function POST(req) {
  const body = await req.json();
  const { email, password, chat_id } = body;

  let authComplete = await checkAuth(email, password);
  if (!authComplete) {
    return NextResponse.json(
      { message: "Authorization required" },
      { status: 401 }
    );
  }

  const user = await getUser(email);
  if (!user) {
    return NextResponse.json({ message: "Database error" }, { status: 500 });
  }

  const chat = await getChatById(chat_id);
  if (chat === null) {
    return NextResponse.json({ message: "Database error" }, { status: 500 });
  }

  switch (user.role) {
    case "patient":
      if (user.id !== chat.patient_id) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
      break;
    case "doctor":
      if (user.id !== chat.doctor_id) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
      break;
    case "moderator":
      break;
    default:
      return NextResponse.json({ message: "No such role" }, { status: 400 });
  }

  const messageList = await getMessageList(chat.id);

  if (messageList === null) {
    return NextResponse.json({ message: "Database error" }, { status: 500 });
  } else {
    return NextResponse.json({ messages: messageList }, { status: 200 });
  }
}

async function getChatById(chat_id) {
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("id", chat_id);

  if (error) {
    console.error("Error:", error);
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
    console.error("Error:", error);
    return null;
  } else {
    return data;
  }
}

async function getUser(email) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email);

  if (error) {
    console.error("Error:", error);
    return null;
  } else {
    return data[0];
  }
}

async function checkAuth(email, password) {
  /*
  затычка, тут проверка авторизации
   */
  return true;
}
