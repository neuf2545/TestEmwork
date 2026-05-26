const { Pool } = require('pg');
const pool = new Pool(); // ตั้งค่า Connection DB

async function processPayroll(empId, baseSalary, otHours, payrollPeriod) {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN'); // เริ่ม Transaction

        // 1. Lock Row ด้วย FOR UPDATE ป้องกัน Race Condition
        const empCheck = await client.query(
            `SELECT emp_id FROM salaries WHERE emp_id = $1 FOR UPDATE`,
            [empId]
        );
        if (empCheck.rows.length === 0) throw new Error('ไม่พบพนักงาน');

        // 2. Idempotency Check ป้องกันการรันจ่ายเงินซ้ำในเดือนเดียวกัน
        const paymentCheck = await client.query(
            `SELECT id FROM payroll_history WHERE emp_id = $1 AND period = $2`,
            [empId, payrollPeriod]
        );
        if (paymentCheck.rows.length > 0) throw new Error('พนักงานรับเงินเดือนรอบนี้ไปแล้ว');

        // 3. แก้ปัญหาทศนิยม (Floating Point) โดยแปลงทุกอย่างเป็น "สตางค์" (Cents)
        const baseSalaryCents = Math.round(baseSalary * 100);
        const ssoCents = Math.round(baseSalaryCents * 0.05);
        const otRateCents = Math.round((baseSalaryCents / 30 / 8) * 1.5);
        
        const grossCents = baseSalaryCents + Math.round(otHours * otRateCents);
        const netCents = grossCents - ssoCents;

        // 4. อัปเดตเงินและบันทึกประวัติ (ใช้ Parameterized Query ป้องกัน SQL Injection)
        await client.query(
            `UPDATE salaries SET balance = balance + $1 WHERE emp_id = $2`,
            [netCents, empId]
        );

        await client.query(
            `INSERT INTO payroll_history (emp_id, period, amount_cents, created_at) 
             VALUES ($1, $2, $3, NOW())`,
            [empId, payrollPeriod, netCents]
        );

        await client.query('COMMIT');
        
        // คืนค่ากลับเป็นหน่วย "บาท" ให้ระบบอื่นไปแสดงผล
        return netCents / 100;

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = processPayroll;
