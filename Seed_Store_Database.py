from pymongo import MongoClient
from datetime import datetime

def seed_restaurants():
    client = MongoClient("mongodb://localhost:27017/")
    db = client["forkast_ai_food"]
    collection = db["Store_catalog"]

    mock_restaurants = [
        {
            "restaurant_name": "ป้าแจ๋ว อาหารตามสั่ง",
            "location": "ซอย 1 ข้างมหาวิทยาลัย",
            "source_url": "https://maps.app.goo.gl/mock1",
            "is_active": True,
            "last_verified_at": datetime.now(),
            "menus": [
                {"menu_name": "ข้าวกะเพราหมูสับไข่ดาว", "price_thb": 50, "allergens": [], "tags": ["spicy", "quick", "comfort"]},
                {"menu_name": "ข้าวผัดต้มยำกุ้ง", "price_thb": 60, "allergens": ["seafood"], "tags": ["spicy"]},
                {"menu_name": "ข้าวไข่เจียวหมูสับ", "price_thb": 40, "allergens": [], "tags": ["comfort", "quick"]}
            ]
        },
        {
            "restaurant_name": "Healthy Bowl (สลัดผักคลีนๆ)",
            "location": "โรงอาหารตึกกลาง",
            "source_url": "https://maps.app.goo.gl/mock2",
            "is_active": True,
            "last_verified_at": datetime.now(),
            "menus": [
                {"menu_name": "สลัดอกไก่ย่าง", "price_thb": 65, "allergens": [], "tags": ["healthy"]},
                {"menu_name": "สลัดแซลมอน", "price_thb": 89, "allergens": ["seafood"], "tags": ["healthy", "social"]}
            ]
        },
        {
            "restaurant_name": "เจ๊หมวย ก๋วยเตี๋ยวต้มยำ",
            "location": "หน้าประตูมหาลัย",
            "source_url": "https://maps.app.goo.gl/mock3",
            "is_active": True,
            "last_verified_at": datetime.now(),
            "menus": [
                {"menu_name": "บะหมี่ต้มยำหมูเด้ง", "price_thb": 50, "allergens": ["peanut"], "tags": ["spicy", "comfort"]},
                {"menu_name": "เส้นเล็กน้ำใส", "price_thb": 45, "allergens": [], "tags": ["comfort", "quick"]}
            ]
        },
        {
            "restaurant_name": "ชาบู หมูกระทะ (บุฟเฟต์)",
            "location": "ซอยหลังมหาลัย",
            "source_url": "https://maps.app.goo.gl/mock4",
            "is_active": True,
            "last_verified_at": datetime.now(),
            "menus": [
                {"menu_name": "บุฟเฟต์หมูกระทะ (รวมน้ำ)", "price_thb": 199, "allergens": ["seafood", "peanut"], "tags": ["social", "comfort"]}
            ]
        }
    ]

    # ล้างข้อมูลเก่าก่อน
    collection.delete_many({})
    
    # บันทึกข้อมูลลงฐานข้อมูล
    collection.insert_many(mock_restaurants)
    
    print(f"บันทึกข้อมูลร้านอาหารสำเร็จแล้ว จำนวน {len(mock_restaurants)} ร้าน!")
    print("--- สรุปเมนูในระบบ ---")
    for r in collection.find():
        print(f"ร้าน: {r['restaurant_name']}")
        for m in r['menus']:
            print(f"   - {m['menu_name']} ({m['price_thb']} บาท) Tags: {m['tags']}")

if __name__ == "__main__":
    seed_restaurants()