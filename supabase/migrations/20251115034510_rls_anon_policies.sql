------------------------------------------------------------
--- POLICIES — INTERDIRE LES MODIFICATIONS AUX ANON
------------------------------------------------------------

-- Programs
CREATE POLICY "Block anon write programs"
ON programs
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Promotions
CREATE POLICY "Block anon write promotions"
ON promotions
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Students
CREATE POLICY "Block anon write students"
ON students
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Students_promotions
CREATE POLICY "Block anon write students_promotions"
ON students_promotions
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

------------------------------------------------------------
-- 4) (OPTIONNEL) Permettre écriture si connecté via supabase auth
------------------------------------------------------------
-- Si un jour tu ajoutes l’identification, ces règles te serviront :
--
-- CREATE POLICY "Allow authenticated write programs"
-- ON programs
-- FOR INSERT, UPDATE, DELETE
-- TO authenticated
-- USING (true)
-- WITH CHECK (true);
--
-- (Même chose pour les autres tables)
------------------------------------------------------------