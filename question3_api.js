const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');

const router = express.Router();
const pool = new Pool();

// คีย์ลับที่รู้เฉพาะ Application Server หรือดึงจาก AWS KMS / HSM (IT/DBA จะไม่รู้คีย์นี้)
const SECRET_HMAC_KEY = process.env.HMAC_KEY || 'super-secret-key-no-one-knows';

// ฟังก์ชันสร้างลายเซ็น (Signature) กำกับข้อมูลเงินเดือน
function generateRowSignature(employeeId, salaryCents, updatedAt) {
    const payload = `${employeeId}:${salaryCents}:${updatedAt.toISOString()}`;
    return crypto.createHmac('sha256', SECRET_HMAC_KEY).update(payload).digest('hex');
}

// ---------------------------------------------------------
// 1. API: Maker ขอสร้างรายการแก้ไขเงินเดือนย้อนหลัง (ยังไม่มีผลจนกว่าจะอนุมัติ)
// ---------------------------------------------------------
router.post('/api/v1/salary-adjustments', async (req, res) => {
    const { employee_id, new_base_salary, effective_date, reason } = req.body;
    const maker_id = req.user.id; // ดึงจาก Token ของคนที่ล็อกอิน (HR)

    try {
        const currentSalaryQuery = await pool.query(`SELECT base_salary_cents FROM salaries WHERE employee_id = $1`, [employee_id]);
        const old_base_salary_cents = currentSalaryQuery.rows[0].base_salary_cents;
        const new_base_salary_cents = Math.round(new_base_salary * 100);

        // บันทึกคำขอลงตาราง Audit / Adjustments
        const result = await pool.query(
            `INSERT INTO salary_adjustments 
            (employee_id, old_base_salary_cents, new_base_salary_cents, effective_date, reason, maker_id, status) 
            VALUES ($1, $2, $3, $4, $5, $6, 'PENDING') RETURNING id`,
            [employee_id, old_base_salary_cents, new_base_salary_cents, effective_date, reason, maker_id]
        );

        res.status(201).json({ message: 'Request created', adjustment_id: result.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// 2. API: Checker อนุมัติรายการแก้ไขเงินเดือน พร้อมสร้าง Signature ใหม่
// ---------------------------------------------------------
router.post('/api/v1/salary-adjustments/:id/approve', async (req, res) => {
    const adjustmentId = req.params.id;
    const checker_id = req.user.id; // ดึงจาก Token ผู้จัดการที่กดอนุมัติ

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // ดึงข้อมูลคำขอ
        const adj = await client.query(`SELECT * FROM salary_adjustments WHERE id = $1 FOR UPDATE`, [adjustmentId]);
        const requestData = adj.rows[0];

        if (requestData.status !== 'PENDING') throw new Error('รายการนี้ถูกประมวลผลไปแล้ว');

        const now = new Date();
        // สร้าง Signature ด้วยคีย์ลับ เพื่อล็อคข้อมูลว่าการแก้ไขมาจากระบบ Application เท่านั้น
        const newSignature = generateRowSignature(requestData.employee_id, requestData.new_base_salary_cents, now);

        // อัปเดตเงินเดือนพนักงาน + ประทับตรา Signature + อัปเดตเวลา
        await client.query(
            `UPDATE salaries 
             SET base_salary_cents = $1, updated_at = $2, row_signature = $3 
             WHERE employee_id = $4`,
            [requestData.new_base_salary_cents, now, newSignature, requestData.employee_id]
        );

        // เปลี่ยนสถานะใบคำขอเป็น APPROVED
        await client.query(
            `UPDATE salary_adjustments SET status = 'APPROVED', checker_id = $1, approved_at = $2 WHERE id = $3`,
            [checker_id, now, adjustmentId]
        );

        // (สามารถเพิ่มโค้ดบันทึกลงตาราง salary_audit_logs แบบมีการร้อย Chain of Hash ต่อที่นี่ได้)

        await client.query('COMMIT');
        res.json({ message: 'Salary adjustment approved successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ---------------------------------------------------------
// ตัวอย่าง Middleware: ฟังก์ชันเช็คว่า IT แอบแก้ Database หรือไม่
// (ระบบจะเรียกใช้ฟังก์ชันนี้เสมอก่อนนำเงินเดือนไปคำนวณ Payroll)
// ---------------------------------------------------------
async function verifyDataIntegrity(employeeId) {
    const result = await pool.query(`SELECT base_salary_cents, updated_at, row_signature FROM salaries WHERE employee_id = $1`, [employeeId]);
    const row = result.rows[0];

    // คำนวณ Signature ใหม่อีกครั้งจากข้อมูลใน DB
    const expectedSignature = generateRowSignature(employeeId, row.base_salary_cents, row.updated_at);

    // หากไม่ตรงกัน แปลว่ามีคนแอบรัน SQL อัปเดตตัวเลขตรงๆ โดยไม่ผ่าน API
    if (expectedSignature !== row.row_signature) {
        // ยิงแจ้งเตือนแผนก Security ทันที และระงับการทำงาน
        throw new Error('CRITICAL SECURITY ALERT: Data tampering detected in database!');
    }
    return true;
}

module.exports = router;
