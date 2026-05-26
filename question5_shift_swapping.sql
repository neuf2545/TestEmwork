/*
 ข้อ 5: Database Modeling for Shifts
 การออกแบบ Database Schema ให้รองรับการสลับกะ (Shift Swapping) เก็บสถานะการอนุมัติ 
 และคำนวณเบี้ยเลี้ยงกะดึกได้อย่างแม่นยำ
*/

-- 1. Database Schema Design

-- (1) shift_types (ตารางอ้างอิงประเภทกะและค่าเบี้ยเลี้ยง)
CREATE TABLE shift_types (
    id INT PRIMARY KEY,
    shift_name VARCHAR(50) NOT NULL, -- เช่น 'Morning', 'Evening', 'Night'
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    night_allowance_rate DECIMAL(10, 2) DEFAULT 0.00 -- เก็บเรทเบี้ยเลี้ยงกะดึก (เช่น 150.00)
);

-- (2) schedules (ตารางเวรการทำงานรายวัน)
CREATE TABLE schedules (
    id BIGSERIAL PRIMARY KEY,
    employee_id INT NOT NULL, -- พนักงานที่เป็น "เจ้าของกะในปัจจุบัน"
    shift_date DATE NOT NULL,
    shift_type_id INT REFERENCES shift_types(id),
    original_employee_id INT NOT NULL, -- เก็บ ID พนักงานที่ถูกจัดเวรให้ตอนแรกสุด (ทำ Audit)
    status VARCHAR(20) DEFAULT 'SCHEDULED' -- 'SCHEDULED', 'COMPLETED'
);

-- (3) shift_swap_requests (ตารางบันทึกการขอสลับกะและการอนุมัติ)
CREATE TABLE shift_swap_requests (
    id BIGSERIAL PRIMARY KEY,
    requester_schedule_id BIGINT REFERENCES schedules(id),
    receiver_schedule_id BIGINT REFERENCES schedules(id),
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    manager_id INT, -- เก็บ ID ของหัวหน้างานที่กด Approve
    approved_at TIMESTAMP,
    reason TEXT
);

-- ==========================================================
-- ตัวอย่าง SQL สำหรับดึงข้อมูลไปคำนวณ Payroll ตอนสิ้นเดือน
-- ==========================================================
-- ระบบจะคำนวณเงินเบี้ยเลี้ยงกะดึกอย่างถูกต้อง 100% แม้จะมีการสลับกะ
-- เนื่องจากพนักงานที่มาสลับจะถูกอัปเดตเป็นเจ้าของกะปัจจุบัน (employee_id) ในตาราง schedules แล้ว

SELECT 
    s.employee_id, 
    COUNT(s.id) AS total_night_shifts,
    SUM(st.night_allowance_rate) AS total_night_allowance
FROM schedules s
INNER JOIN shift_types st ON s.shift_type_id = st.id
WHERE 
    s.shift_date BETWEEN '2026-03-01' AND '2026-03-31'
    -- กรองเอาเฉพาะกะที่มีค่าเบี้ยเลี้ยงกะดึก (> 0)
    AND st.night_allowance_rate > 0
    -- ต้องเป็นกะที่ทำงานเสร็จสมบูรณ์แล้ว ไม่ใช่แค่จัดเวรไว้
    AND s.status = 'COMPLETED' 
GROUP BY s.employee_id;
