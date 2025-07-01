import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export async function POST(req) {
  const body = await req.json();
  const { email, password, filter } = body;
  //filter - какой-то фильтр из заранее определенного набора.
  //Например, выбрать только активные чаты,
  //выбрать только чаты с определенным пациентом, и т.д.

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

  const chatList = await getChatList(user.id, user.role, filter);
  if (chatList === null) {
    return NextResponse.json({ message: "Database error" }, { status: 500 });
  } else {
    return NextResponse.json({ chats: chatList }, { status: 200 });
  }
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

  //здесь алгоритм выбора, учитывающий разные фильтры
  //например, только чаты с активным диалогом с врачом:
  if (filter === "active") {
    query = query.eq("status", "in_consultation");
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error:", error);
    return null;
  }

  return data;
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
