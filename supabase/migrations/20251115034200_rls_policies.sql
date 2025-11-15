-- Activer RLS
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE students_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

-- Exemple de policy lecture publique
CREATE POLICY "Public read promotions"
ON promotions
FOR SELECT
USING (true);

CREATE POLICY "Public read students"
ON students
FOR SELECT
USING (true);

CREATE POLICY "Public read programs"
ON programs
FOR SELECT
USING (true);

CREATE POLICY "Public read student promotions"
ON students_promotions
FOR SELECT
USING (true);
