# UI rollout flags

ซ่อน/เปิดฟีเจอร์ทีละส่วนระหว่างทยอยปล่อยใช้งาน  
เปลี่ยนค่า `true` / `false` ในไฟล์ที่ระบุ — ไม่ต้องลบโค้ด

## เมนูข้าง (navbar)

ไฟล์: `components/shell.tsx`

| Flag | ค่าปัจจุบัน | สิ่งที่ควบคุม | URL ที่เกี่ยวข้อง |
|---|---|---|---|
| `SHOW_PLAN_NAV` | `false` | แผนรอบปลูก (แผนรวม / แผนรายเกษตรกร) | `/plan`, `/plan/members` |
| `SHOW_SUPPLY_NAV` | `false` | แผนรับข้าว | `/supply` |
| `SHOW_MANAGE_NAV` | `false` | จัดการ (พันธุ์ข้าว / ชนิดสินค้า) | `/manage/varieties`, `/manage/product-kinds` |
| `SHOW_PERMISSIONS_NAV` | `false` | จัดการสิทธิ์ | `/permissions`, `/permissions/people` |

เมื่อ flag เป็น `false`:

- เมนูหายจาก navbar
- เข้า URL ตรงๆ จะถูกเด้งกลับหน้าแรก (`HOME_PATH`)

หน้าแรกตอนนี้: `/farmers` (เพราะ `SHOW_PLAN_NAV` ปิดอยู่)

ต้องอัปเดต redirect ใน `app/page.tsx`, `app/dashboard/page.tsx`, `app/not-found.tsx` ด้วย ถ้าเปลี่ยนหน้าแรกกลับไป `/plan`

## หน้าจัดการเกษตรกร

ไฟล์: `components/groups-screen.tsx` (`MemberManageScreen`)

| Flag | ค่าปัจจุบัน | สิ่งที่ควบคุม |
|---|---|---|
| `SHOW_MEMBER_PLOT_TABS` | `true` | แท็บ แปลงของเกษตรกร (ลงทะเบียนแปลงได้) |
| `SHOW_MEMBER_PLAN_TABS` | `false` | แท็บ แผนการปลูก + ปุ่ม/คอลัมน์รอบปลูก |
| `SHOW_MEMBER_RECEIPT_SECTIONS` | `false` | สถานะรับซื้อ + บัญชีซื้อขายโรงสี ในรายละเอียดเกษตรกร |

## เมนูที่เปิดอยู่ตอนนี้

1. เกษตรกร / จัดการเกษตรกร  
2. กลุ่ม / จัดการกลุ่ม  
3. แผนที่แปลง / จัดการแปลง  

ในจัดการเกษตรกร: รายการ + รายละเอียด + แปลง (ยังไม่มีแผนปลูก / บัญชีรับซื้อ)

## วิธีเปิดฟีเจอร์กลับ

1. ตั้ง flag ที่เกี่ยวข้องเป็น `true`
2. ถ้าเปิด `SHOW_PLAN_NAV` และอยากให้เป็นหน้าแรก → ตั้ง `HOME_PATH` / redirect ใน `app/*` กลับเป็น `/plan`
3. smoke-check เมนู + เข้า URL ตรงๆ ว่าไม่เด้งผิดหน้า
