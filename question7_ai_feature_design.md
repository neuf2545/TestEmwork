# ข้อ 7: AI Feature Design

**หัวข้อ:** Smart Shift Scheduler — จัดกะอัตโนมัติเพื่อลด OT

---

## 1. Architecture Diagram
การออกแบบสถาปัตยกรรมระบบ Smart Shift Scheduler โดยให้ความสำคัญกับ Data Privacy เป็นศูนย์กลาง เมื่อต้องทำงานร่วมกับ AI Model

```mermaid
graph TD
    subgraph Internal Secure Network
        A[(HRIS & Payroll DB)] -->|Raw Employee Data| B[Data Anonymizer / PII Masking]
        B -->|Anonymized Data| C[Data Pipeline / Feature Store]
        E[Shift Validation & Rules Engine] -->|De-anonymize & Update| A
        F[HR Manager / Planner UI] -->|Approve/Edit| E
    end
    
    subgraph AI Infrastructure (Cloud / Private VPC)
        D((AI Scheduler Model))
    end
    
    C -->|Hash IDs, Skills, Max Hours, Shift Constraints| D
    D -->|Optimized Roster (using Hash IDs)| E
```

**คำอธิบาย Diagram:**
1. **HRIS DB:** ดึงข้อมูลพนักงาน สถิติการลา และชั่วโมงการทำงาน
2. **Data Anonymizer:** รับข้อมูลดิบมาลบข้อมูลส่วนบุคคลที่ระบุตัวตนได้ (PII) ออก และเข้ารหัสชื่อพนักงานเป็น Hash ID ก่อนส่งออกนอกระบบ
3. **AI Scheduler Model:** รับข้อมูลที่ไม่มีการระบุตัวตนเข้าไปประมวลผลเพื่อหา Pattern การจัดกะที่ดีที่สุด (Optimization) เพื่อลดต้นทุน OT
4. **Shift Validation:** AI ส่งตารางที่จัดเสร็จกลับมา ระบบภายในจะแปลง Hash ID กลับเป็นชื่อคนจริงผ่าน Mapping Table ภายใน และให้ HR Manager ตรวจสอบก่อนประกาศใช้

---

## 2. การจัดการ Data Privacy เมื่อส่งข้อมูลให้ AI Model

การประมวลผลด้วย AI มีความเสี่ยงด้านข้อมูลส่วนบุคคลและการละเมิดกฎหมาย (PDPA/GDPR) สูงมาก ดังนั้นระบบจะต้องมีมาตรการจัดการที่รัดกุมดังนี้:

### 2.1 Data Anonymization & Pseudonymization (การปิดบังตัวตนอย่างสมบูรณ์)
- **หลักการ:** AI ไม่จำเป็นต้องรู้ว่าพนักงานคือใคร มันต้องการรู้แค่ความสามารถและชั่วโมงการทำงานเท่านั้น
- **วิธีทำ:** ก่อนส่งข้อมูลออกไปยัง AI ระบบ `Data Anonymizer` จะสลับชื่อพนักงาน (เช่น "สมชาย รักดี") เป็นนามแฝงหรือ Hash Key (เช่น `Emp_8A9X`) ข้อมูลที่ส่งให้ AI จะหน้าตาเป็นเพียง `[Emp_8A9X, Skill_Level=Senior, Worked_Hours=35, Max_Hours=40]` 
- เมื่อ AI ประมวลผลเสร็จแล้วส่งตารางเวรของ `Emp_8A9X` กลับมา **ระบบฐานข้อมูลภายในบริษัทเท่านั้นที่มี "กุญแจ (Mapping Table)"** ที่จะแปลง `Emp_8A9X` กลับมาเป็น "สมชาย รักดี" เพื่อแสดงผลบนหน้าจอ HR

### 2.2 Data Minimization (ส่งข้อมูลเท่าที่จำเป็น)
- ฟิลเตอร์ตัดฟิลด์ข้อมูลที่ไม่มีผลต่อการจัดกะทิ้งทั้งหมดก่อนส่งเข้า AI Pipeline เช่น เพศ, ศาสนา, ที่อยู่, เบอร์โทรศัพท์, รหัสประจำตัวประชาชน 
- **หลีกเลี่ยงการส่งเงินเดือนดิบ:** แม้เงินเดือนจะมีผลต่อการคำนวณลดต้นทุน OT แต่เราจะไม่ส่งตัวเลขเงินบาทตรงๆ ให้ AI แต่จะแปลงเงินเดือนเป็น **Cost Score** (เช่น ระดับ 1-5 หรือ Weight Factor) แทน เพื่อไม่ให้ AI หรือผู้ดูแล AI ล่วงรู้ฐานเงินเดือนจริงของพนักงาน

### 2.3 Zero Data Retention Policy (สัญญาระดับ Enterprise)
- หากเลือกใช้ Cloud AI Model จากภายนอก (เช่น OpenAI API, Azure AI, AWS) จะต้องเลือกใช้บริการระดับ Enterprise (B2B) และทำ Data Privacy Agreement (DPA) ระบุเงื่อนไข **"Zero Data Retention"**
- เงื่อนไขนี้จะบังคับไม่ให้ผู้ให้บริการคลาวด์เก็บ Log ข้อมูลของเราไว้ในเซิร์ฟเวอร์ และ **ห้ามนำข้อมูลพนักงานเราไป Train AI Model ของพวกเขาโดยเด็ดขาด**

### 2.4 On-Premise / Private Cloud Deployment (ทางเลือกขั้นสูงสุด)
- หากข้อมูลของบริษัทมีความอ่อนไหวสูงมาก การประมวลผลจะเปลี่ยนไปใช้ **Open-Source AI Model** (เช่น Llama 3 หรือระบบ Optimization Algorithm แบบดั้งเดิม) โดยนำมาติดตั้งบน Server ภายในบริษัทเอง (On-Premise) หรือ Private VPC (Virtual Private Cloud) 
- วิธีนี้จะการันตีได้ 100% ว่าข้อมูลพนักงานที่ถูกส่งเข้าไปประมวลผลใน AI จะไม่หลุดออกสู่อินเทอร์เน็ตสาธารณะเลย
