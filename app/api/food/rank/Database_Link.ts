import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const client = new MongoClient(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/");

export async function GET() {
  try {
    await client.connect();
    const db = client.db("food_db"); // อย่าลืมเปลี่ยนชื่อ db ให้ตรงของคุณ

    // ดึงข้อมูลทั้งหมด แตก Array เมนู และเอาเฉพาะที่ยังเปิดร้านและไม่ติด Blacklist
    const allFoods = await db.collection("stores").aggregate([
      { $unwind: "$Menu" },
      { $match: { "Is_Active": true, "Menu.Blacklist": false } },
      {
        $project: {
          _id: 1,
          Store_Name: 1,
          Location: 1,
          Store_Picture_Source: 1,
          "Menu.Menu_Name": 1,
          "Menu.Price_THB": 1,
          "Menu.Tags": 1,
          "Menu.Allergens": 1,
          "Menu.Menu_Picture_Source": 1
        }
      }
    ]).toArray();

    return NextResponse.json({ success: true, data: allFoods });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }
}