CREATE TABLE "index_counters" (
	"key" text PRIMARY KEY NOT NULL,
	"n" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "institutes" ADD COLUMN "code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "index_no" text;--> statement-breakpoint
-- ආයතන කේතය: නමේ ඉංග්‍රීසි අකුරු වල මුල් අකුරු (උපරිම 4), නැතිනම් පළමු අකුරු 3; අකුරු නැතිනම් INS. අද්විතීය (ICT = Admin ලාට වෙන්කර ඇත)
CREATE FUNCTION make_institute_code(nm text) RETURNS text AS $$
DECLARE
  words text[];
  w text;
  c text := '';
  base text;
  cand text;
  i int := 1;
BEGIN
  words := array_remove(regexp_split_to_array(upper(regexp_replace(coalesce(nm, ''), '[^A-Za-z0-9 ]', ' ', 'g')), '\s+'), '');
  IF coalesce(array_length(words, 1), 0) >= 2 THEN
    FOREACH w IN ARRAY words LOOP
      c := c || left(w, 1);
      EXIT WHEN length(c) >= 4;
    END LOOP;
  ELSIF coalesce(array_length(words, 1), 0) = 1 THEN
    c := left(words[1], 3);
  END IF;
  IF length(c) < 2 THEN c := 'INS'; END IF;
  base := c;
  cand := c;
  WHILE cand = 'ICT' OR EXISTS (SELECT 1 FROM institutes WHERE code = cand) LOOP
    i := i + 1;
    cand := left(base, 5) || i::text;
  END LOOP;
  RETURN cand;
END
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE FUNCTION institutes_assign_code() RETURNS trigger AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := make_institute_code(NEW.name);
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER institutes_assign_code BEFORE INSERT ON institutes FOR EACH ROW EXECUTE FUNCTION institutes_assign_code();
--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, name FROM institutes WHERE code = '' ORDER BY created_at, id LOOP
    UPDATE institutes SET code = make_institute_code(r.name) WHERE id = r.id;
  END LOOP;
END
$$;
--> statement-breakpoint
ALTER TABLE "institutes" ADD CONSTRAINT "institutes_code_unique" UNIQUE("code");--> statement-breakpoint
-- Index අංකය: <ආයතන කේතය | ICT>-<S සිසුන් | A Admin>-<ලියාපදිංචි වර්ෂය (ශ්‍රී ලංකා)>-<අනුක්‍රමික 4 ඉලක්කම්>
CREATE FUNCTION next_user_index(r text, inst text, created timestamp) RETURNS text AS $$
DECLARE
  c text;
  k text;
  y int;
  v_key text;
  v_n int;
BEGIN
  k := CASE WHEN r = 'STUDENT' THEN 'S' ELSE 'A' END;
  IF k = 'S' THEN
    SELECT code INTO c FROM institutes WHERE id = inst;
  END IF;
  c := coalesce(nullif(c, ''), 'ICT');
  y := extract(year FROM ((created AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Colombo'))::int;
  v_key := c || '-' || k || '-' || y;
  INSERT INTO index_counters AS ic (key, n) VALUES (v_key, 1)
    ON CONFLICT (key) DO UPDATE SET n = ic.n + 1
    RETURNING ic.n INTO v_n;
  RETURN v_key || '-' || lpad(v_n::text, 4, '0');
END
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE FUNCTION users_assign_index() RETURNS trigger AS $$
BEGIN
  IF NEW.index_no IS NULL THEN
    NEW.index_no := next_user_index(NEW.role::text, NEW.institute_id, NEW.created_at);
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER users_assign_index BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION users_assign_index();
--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, role::text AS rl, institute_id, created_at FROM users WHERE index_no IS NULL ORDER BY created_at, id LOOP
    UPDATE users SET index_no = next_user_index(r.rl, r.institute_id, r.created_at) WHERE id = r.id;
  END LOOP;
END
$$;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_index_no_unique" UNIQUE("index_no");
