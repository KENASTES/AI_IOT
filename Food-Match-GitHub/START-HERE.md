# Food Match — AI กินไรดี

โฟลเดอร์นี้คือ source code ทั้งโปรเจกต์สำหรับนำขึ้น GitHub

## ไฟล์สำคัญ

- `app/page.tsx` — หน้าเว็บและ interaction ทั้งหมด
- `app/globals.css` — ธีมและ Tailwind CSS
- `public/` — รูปอาหารและ favicon
- `components/ui/` — UI components
- `db/` และ `drizzle/` — จุดเริ่มต้นสำหรับเชื่อมฐานข้อมูล
- `package.json` — dependencies และคำสั่งรันโปรเจกต์

โฟลเดอร์ `vendor/` มีเพียง stylesheet ที่ component system ใช้ จึงไม่ใช่ทั้งโปรเจกต์

## วิธีเปิดโปรเจกต์

ต้องติดตั้ง Node.js 22.13 ขึ้นไป จากนั้นเปิด Terminal ที่โฟลเดอร์นี้แล้วรัน:

```bash
npm install
npm run dev
```

เปิด URL ที่แสดงใน Terminal โดยปกติคือ `http://127.0.0.1:5173`

## Build

```bash
npm run build
```

ข้อมูลร้าน ราคา พิกัด งบ และ Food Memory ในรุ่นนี้เป็นข้อมูลเดโม ทีม backend สามารถแทนที่ข้อมูลใน `app/page.tsx` ด้วย API และฐานข้อมูลจริงได้
