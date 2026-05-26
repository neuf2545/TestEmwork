-- 1. ตารางพนักงานหลัก
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL -- 'HR', 'IT', 'HR_Manager', 'Employee'
);

-- 2. ตารางยอดเงินปัจจุบัน (เก็บเฉพาะสถานะปัจจุบัน)
CREATE TABLE salaries (
    employee_id INT PRIMARY KEY REFERENCES employees(id),
    base_salary_cents INT NOT NULL, -- เก็บในหน่วยสตางค์ (เช่น 65,000.00 บาท = 6500000)
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    row_signature VARCHAR(256) NOT NULL -- [สำคัญ] ลายเซ็นดิจิทัลป้องกัน IT แอบแก้ DB
);

-- 3. ตารางบันทึกการขอแก้ไขเงินเดือน (Maker-Checker Workflow)
CREATE TABLE salary_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id INT NOT NULL REFERENCES employees(id),
    old_base_salary_cents INT NOT NULL,
    new_base_salary_cents INT NOT NULL,
    effective_date DATE NOT NULL, -- วันที่มีผลย้อนหลัง
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    maker_id INT NOT NULL REFERENCES employees(id), -- ใครขอแก้
    checker_id INT REFERENCES employees(id), -- ใครอนุมัติ
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    row_signature VARCHAR(256) NOT NULL -- ลายเซ็นดิจิทัลประจำแถวข้อมูล
);

-- 4. ตารางบันทึก Audit Trail ของระบบ (System-Level Audit Log)
CREATE TABLE salary_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    employee_id INT NOT NULL REFERENCES employees(id),
    adjustment_id UUID REFERENCES salary_adjustments(id), -- เชื่อมโยงกับใบคำขอ
    action_type VARCHAR(10) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
    old_value TEXT,
    new_value TEXT,
    modified_by INT NOT NULL REFERENCES employees(id), -- ใครเปลี่ยนค่า
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45) NOT NULL, -- IP ของผู้ดำเนินการ
    user_agent TEXT,
    previous_hash VARCHAR(256) NOT NULL, -- [สำคัญ] แฮชของล็อกก่อนหน้าเพื่อทำ Blockchain-like Chain
    row_hash VARCHAR(256) NOT NULL -- แฮชประจำแถวปัจจุบัน
);
