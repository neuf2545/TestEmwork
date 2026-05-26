-- ค้นหาพนักงานกะ Night ของวันที่ 19 มีนาคม 2026 ที่มาสาย (เข้างานหลัง 00:05 น.)
SELECT 
    s.employee_id,
    s.shift_date,
    s.shift_type,
    c.clock_in_time
FROM schedules s
INNER JOIN clock_ins c 
    ON s.employee_id = c.employee_id
WHERE 
    s.shift_date = '2026-03-19'
    AND s.shift_type = 'Night'
    
    -- กำหนดช่วงเวลาการสแกนนิ้วที่ตีความว่าเป็นของกะนี้
    -- (รองรับคนสแกนก่อนเที่ยงคืน เช่น 23:55 น. ของวันที่ 18 มี.ค. จนถึง 08:00 น. ของ 19 มี.ค.)
    AND c.clock_in_time BETWEEN '2026-03-18 23:00:00' AND '2026-03-19 08:00:00'
    
    -- เงื่อนไขคนมาสาย: เวลาสแกนต้องเลย 00:05 น. ของวันที่ 19 มี.ค. ไปแล้ว
    AND c.clock_in_time > '2026-03-19 00:05:00';
