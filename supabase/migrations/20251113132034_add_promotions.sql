-- 1️⃣ Create table promotions
CREATE TABLE IF NOT EXISTS promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    program_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
    );

CREATE TABLE students_promotions (
     student_id UUID REFERENCES students(id) ON DELETE CASCADE,
     promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
     PRIMARY KEY (student_id, promotion_id)
);

-- 2️⃣ Add promotion_id column to students
ALTER TABLE students
    ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES promotions(id) ON DELETE SET NULL;

-- 3️⃣ (Optional) If you want to link students later manually:
-- UPDATE students SET promotion_id = (SELECT id FROM promotions WHERE name = 'Brune Automne 2025') WHERE ...;

-- 4️⃣ Add index for performance
CREATE INDEX IF NOT EXISTS idx_students_promotion_id ON students(promotion_id);
