-- ===========================================================
-- Schema: Shinden-Ryu Evaluation System
-- ===========================================================

-- 1️⃣ Table: programs
CREATE TABLE programs (
                          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                          name TEXT NOT NULL,
                          description TEXT,
                          version TEXT,
                          json_source_url TEXT,
                          active BOOLEAN DEFAULT TRUE,
                          created_at TIMESTAMPTZ DEFAULT now()
);

-- 2️⃣ Table: categories
CREATE TABLE categories (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
                            key TEXT NOT NULL,
                            title TEXT NOT NULL,
                            help TEXT,
                            weight NUMERIC(5,2) CHECK (weight >= 0),
                            created_at TIMESTAMPTZ DEFAULT now()
);

-- 3️⃣ Table: sub_technics
CREATE TABLE techniques (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
                            name TEXT NOT NULL,
                            created_at TIMESTAMPTZ DEFAULT now()
);

-- 4️⃣ Table: students
CREATE TABLE students (
                          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                          name TEXT NOT NULL,
                          active BOOLEAN DEFAULT TRUE,
                          created_at TIMESTAMPTZ DEFAULT now()
);


-- 5️⃣ Table: evaluations
CREATE TABLE evaluations (
                             id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                             student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                             program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
                             category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
                             technique_id UUID NOT NULL REFERENCES techniques(id) ON DELETE CASCADE,
                             evaluator_name TEXT NOT NULL,
                             score NUMERIC(5,2) CHECK (score >= 0 AND score <= 10),
                             comment TEXT,
                             evaluated_at TIMESTAMPTZ DEFAULT now(),
                             UNIQUE(student_id, program_id, category_id, technique_id, evaluator_name)
);

-- ===========================================================
-- Indexes
-- ===========================================================
CREATE INDEX idx_evaluations_student ON evaluations(student_id);
CREATE INDEX idx_evaluations_programme ON evaluations(program_id);
CREATE INDEX idx_evaluations_category ON evaluations(category_id);
CREATE INDEX idx_evaluations_evaluator ON evaluations(evaluator_name);

-- ===========================================================
-- Optional: View for weighted average per student & programme
-- ===========================================================
CREATE VIEW student_programme_summary AS
SELECT
    e.student_id,
    e.program_id,
    ROUND(SUM(e.score * (c.weight / 100)) / COUNT(DISTINCT c.id), 2) AS weighted_average,
    COUNT(DISTINCT e.evaluator_name) AS evaluator_count
FROM evaluations e
         JOIN categories c ON e.category_id = c.id
GROUP BY e.student_id, e.program_id;

-- ===========================================================
-- Optional: View for category averages per student
-- ===========================================================
CREATE VIEW student_category_summary AS
SELECT
    e.student_id,
    e.program_id,
    e.category_id,
    ROUND(AVG(e.score), 2) AS avg_score,
    c.weight
FROM evaluations e
         JOIN categories c ON e.category_id = c.id
GROUP BY e.student_id, e.program_id, e.category_id, c.weight;

-- ===========================================================
-- Helper function: Validate total weight of a programme = 100
-- ===========================================================
CREATE OR REPLACE FUNCTION validate_program_weights()
RETURNS TRIGGER AS $$
DECLARE
total_weight NUMERIC(6,2);
BEGIN
SELECT SUM(weight) INTO total_weight FROM categories WHERE program_id = NEW.program_id;
IF total_weight <> 100 THEN
        RAISE EXCEPTION 'Invalid total weight for programme %, got % instead of 100', NEW.program_id, total_weight;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_weights
    AFTER INSERT OR UPDATE ON categories
                        FOR EACH ROW
                        EXECUTE FUNCTION validate_program_weights();
