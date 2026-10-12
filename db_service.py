from pymongo import MongoClient
from datetime import datetime

# เชื่อมต่อกับ MongoDB (ใช้ localhost เพราะรันบนเครื่องตัวเอง)
MONGO_URI = "mongodb://localhost:27017/"
client = MongoClient(MONGO_URI)

# สร้าง/เรียกใช้ Database และ Collection
db = client["forkast_db"]
ingredients_collection = db["ingredient_price_reference"]
memory_collection = db["saved_scenarios"]

def seed_mock_ingredients():
    """ฟังก์ชันสำหรับใส่ข้อมูลวัตถุดิบและราคาตั้งต้น (Run แค่ครั้งแรก)"""
    
    # ข้อมูลจำลอง (Mock Data) สำหรับ MVP
    mock_data = [
        {"ingredient": "ไข่ไก่", "unit": "ฟอง", "price_thb": 5, "last_verified_at": datetime.now()},
        {"ingredient": "หมูสับ", "unit": "100 กรัม", "price_thb": 15, "last_verified_at": datetime.now()},
        {"ingredient": "เนื้อไก่", "unit": "100 กรัม", "price_thb": 10, "last_verified_at": datetime.now()},
        {"ingredient": "กะหล่ำปลี", "unit": "1 หัว", "price_thb": 20, "last_verified_at": datetime.now()},
        {"ingredient": "ข้าวหอมมะลิ (หุงแล้ว)", "unit": "1 ถ้วย", "price_thb": 10, "last_verified_at": datetime.now()},
        {"ingredient": "กุ้งสด", "unit": "100 กรัม", "price_thb": 35, "last_verified_at": datetime.now()},
        {"ingredient": "กระเทียม", "unit": "1 หัว", "price_thb": 5, "last_verified_at": datetime.now()}
    ]
    
    # เช็คว่ามีข้อมูลอยู่แล้วหรือยัง ถ้ายังไม่มีให้ Insert ลงไป
    if ingredients_collection.count_documents({}) == 0:
        ingredients_collection.insert_many(mock_data)
        print("Seeded mock ingredients successfully!")
    else:
        print("Data already exists in database.")

def get_all_ingredients():
    """ฟังก์ชันให้เพื่อน (AI/UI) ดึงข้อมูลวัตถุดิบทั้งหมดไปใช้"""
    # ดึงข้อมูลทั้งหมดโดยไม่เอาฟิลด์ _id ของ Mongo ไปด้วย
    return list(ingredients_collection.find({}, {"_id": 0}))

# สำหรับทดสอบรันไฟล์นี้ตรงๆ
if __name__ == "__main__":
    print("Testing Database Connection...")
    seed_mock_ingredients()
    
    print("\n--- Current Ingredients in DB ---")
    items = get_all_ingredients()
    for item in items:
        print(f"{item['ingredient']} - {item['price_thb']} บาท / {item['unit']}")