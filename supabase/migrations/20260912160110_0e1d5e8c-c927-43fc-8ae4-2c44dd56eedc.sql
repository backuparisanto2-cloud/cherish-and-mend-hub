CREATE TABLE public.chatera_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  message_id text,
  conversation_id text,
  channel_id text,
  sender_phone text,
  sender_name text,
  content_text text,
  event_timestamp timestamptz,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chatera_messages_received_at_idx ON public.chatera_messages (received_at DESC);

GRANT SELECT ON public.chatera_messages TO anon;
GRANT SELECT ON public.chatera_messages TO authenticated;
GRANT ALL ON public.chatera_messages TO service_role;

ALTER TABLE public.chatera_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read inbound messages"
  ON public.chatera_messages
  FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER TABLE public.chatera_messages
  ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'inbound';

CREATE INDEX IF NOT EXISTS chatera_messages_sender_phone_idx
  ON public.chatera_messages (sender_phone, received_at);

CREATE TYPE public.conversation_status AS ENUM ('bot_active','waiting_agent','agent_active','closed');
CREATE TYPE public.message_sender_type AS ENUM ('user','bot','agent');

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatera_contact_id text UNIQUE,
  wa_number text,
  name text,
  email text,
  channel_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contacts_wa_number_key ON public.contacts (wa_number) WHERE wa_number IS NOT NULL;
GRANT SELECT ON public.contacts TO anon, authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read contacts" ON public.contacts FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chatera_conversation_id text UNIQUE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
  status public.conversation_status NOT NULL DEFAULT 'bot_active',
  assigned_agent_chatera_id text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_last_message_at_idx ON public.conversations (last_message_at DESC);
GRANT SELECT ON public.conversations TO anon, authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read conversations" ON public.conversations FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  chatera_message_id text UNIQUE,
  whatsapp_message_id text,
  direction text NOT NULL DEFAULT 'inbound',
  sender_type public.message_sender_type NOT NULL DEFAULT 'user',
  content_type text NOT NULL DEFAULT 'text',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_created_idx ON public.messages (conversation_id, created_at);
GRANT SELECT ON public.messages TO anon, authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read messages" ON public.messages FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id text NOT NULL UNIQUE,
  event text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

CREATE TABLE public.knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'Umum',
  title text NOT NULL,
  answer text NOT NULL DEFAULT '',
  keywords text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base TO authenticated;
GRANT ALL ON public.knowledge_base TO service_role;

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read knowledge base" ON public.knowledge_base FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert knowledge base" ON public.knowledge_base FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update knowledge base" ON public.knowledge_base FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete knowledge base" ON public.knowledge_base FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON public.knowledge_base FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_knowledge_base_category ON public.knowledge_base (category);

INSERT INTO public.knowledge_base (category, title, answer, keywords, is_active) VALUES
('PORJO','Cara membuat aduan baru','Warga dapat membuat aduan melalui portal PORJO dengan melampirkan foto bukti, lokasi kejadian, dan kronologi singkat.',ARRAY['aduan','lapor','porjo'],true),
('PORJO','Cek status progress aduan','Login ke portal aduan, buka menu Aduan, pilih aduan Anda, lalu klik tombol komentar untuk melihat balasan dinas.',ARRAY['status','progress','aduan'],true),
('RSUD & Puskesmas','Jadwal dokter RSUD Tjitrowardojo','Jadwal dokter dan antrean online dapat diakses melalui aplikasi SIMRS Mobile RSUD dr. Tjitrowardojo.',ARRAY['jadwal','dokter','rsud','antrean'],true),
('RSUD & Puskesmas','Kontak dan alamat puskesmas','Terdapat 27 puskesmas se-Kabupaten Purworejo yang melayani rawat jalan, rawat inap tertentu, dan kegawatdaruratan tingkat pertama.',ARRAY['puskesmas','alamat','kontak'],true),
('Disdukcapil','Syarat pembuatan Kartu Keluarga','Pengajuan pembuatan atau perubahan data Kartu Keluarga dilakukan melalui formulir daring Disdukcapil dengan melampirkan dokumen pendukung.',ARRAY['kk','kartu keluarga','syarat'],true),
('Disdukcapil','Pengajuan Kartu Identitas Anak','KIA diterbitkan untuk anak di bawah 17 tahun dengan melampirkan akta kelahiran, KK, dan foto anak.',ARRAY['kia','anak','identitas'],true),
('Disdukcapil','Layanan pindah penduduk','Layanan pindah jiwa antar Desa, Kecamatan, Kabupaten, atau Provinsi diajukan melalui formulir pindah penduduk.',ARRAY['pindah','domisili'],false),
('DPMPTSP','Perizinan berusaha berbasis risiko (OSS)','Legalitas usaha terintegrasi elektronik untuk risiko rendah hingga tinggi: NIB, Sertifikat Standar, dan Izin.',ARRAY['oss','nib','izin usaha'],true),
('DPMPTSP','Surat Izin Praktik tenaga medis','Penerbitan SIP membutuhkan STR aktif, rekomendasi organisasi profesi, dan surat keterangan tempat praktik.',ARRAY['sip','dokter','izin praktik'],true),
('DPMPTSP','PBG dan Sertifikat Laik Fungsi','Pengajuan PBG/SLF memerlukan bukti kepemilikan tanah, gambar rencana teknis, dan data pemilik bangunan.',ARRAY['pbg','slf','bangunan'],false),
('BPPKAD','Cek tagihan PBB-P2','Tagihan Pajak Bumi dan Bangunan Perdesaan dan Perkotaan dapat dicek dengan memasukkan NOP pada portal pajak daerah.',ARRAY['pbb','pajak','tagihan'],true),
('BPPKAD','Pengurusan BPHTB','Bea Perolehan Hak Atas Tanah dan/atau Bangunan diajukan dengan dokumen akta, SPPT, dan bukti bayar PBB terakhir.',ARRAY['bphtb','tanah','bea'],true),
('CCTV','Pantau CCTV lewat Lekjo','Masyarakat dapat memantau CCTV publik melalui website Lekjo (Lensa Kabupaten Purworejo).',ARRAY['cctv','lekjo','pantau'],true),
('Umum','Jam layanan operator','Operator melayani Senin sampai Jumat pukul 07.30 - 16.00 WIB melalui helpdesk resmi.',ARRAY['jam kerja','operator','helpdesk'],true),
('Umum','Cara kembali ke menu utama','Warga dapat mengetik angka 0 kapan saja untuk kembali ke menu utama chatbot.',ARRAY['menu','navigasi','0'],true);

CREATE TYPE public.knowledge_document_status AS ENUM ('processing', 'done', 'failed');

CREATE TABLE public.knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_type text NOT NULL,
  storage_path text NOT NULL,
  category text NOT NULL DEFAULT 'Umum',
  status public.knowledge_document_status NOT NULL DEFAULT 'processing',
  error_message text,
  entries_created integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_documents TO anon, authenticated;
GRANT ALL ON public.knowledge_documents TO service_role;

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read knowledge documents" ON public.knowledge_documents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert knowledge documents" ON public.knowledge_documents FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update knowledge documents" ON public.knowledge_documents FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete knowledge documents" ON public.knowledge_documents FOR DELETE TO anon, authenticated USING (true);

ALTER TABLE public.knowledge_base
  ADD COLUMN source_document_id uuid REFERENCES public.knowledge_documents(id) ON DELETE CASCADE;
CREATE INDEX idx_knowledge_base_source_document ON public.knowledge_base(source_document_id);

-- Roles
CREATE TYPE public.app_role AS ENUM ('owner', 'admin');

CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  role public.app_role NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = _user_id AND role = _role);
$$;

CREATE POLICY "Users can read own account"
  ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Owners can read all accounts"
  ON public.users FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'owner'));

-- Track which signed-in agent sent an outbound message
ALTER TABLE public.messages
  ADD COLUMN agent_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN agent_name text;

-- Lock down previously public data to signed-in users only
DROP POLICY IF EXISTS "Public read inbound messages" ON public.chatera_messages;
CREATE POLICY "Authenticated read inbound messages" ON public.chatera_messages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read contacts" ON public.contacts;
CREATE POLICY "Authenticated read contacts" ON public.contacts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read conversations" ON public.conversations;
CREATE POLICY "Authenticated read conversations" ON public.conversations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read messages" ON public.messages;
CREATE POLICY "Authenticated read messages" ON public.messages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Public read knowledge base" ON public.knowledge_base;
DROP POLICY IF EXISTS "Public insert knowledge base" ON public.knowledge_base;
DROP POLICY IF EXISTS "Public update knowledge base" ON public.knowledge_base;
DROP POLICY IF EXISTS "Public delete knowledge base" ON public.knowledge_base;
CREATE POLICY "Authenticated manage knowledge base" ON public.knowledge_base
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Public insert knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Public update knowledge documents" ON public.knowledge_documents;
DROP POLICY IF EXISTS "Public delete knowledge documents" ON public.knowledge_documents;
CREATE POLICY "Authenticated manage knowledge documents" ON public.knowledge_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.chatera_messages FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.contacts FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.conversations FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.messages FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.knowledge_base FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.knowledge_documents FROM anon;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE TABLE public.bot_menus (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id uuid REFERENCES public.bot_menus(id) ON DELETE CASCADE,
  key text NOT NULL DEFAULT '',
  path text NOT NULL UNIQUE,
  emoji text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Umum',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX bot_menus_parent_id_idx ON public.bot_menus(parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_menus TO authenticated;
GRANT ALL ON public.bot_menus TO service_role;

ALTER TABLE public.bot_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage bot menus"
  ON public.bot_menus FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_bot_menus_updated_at
  BEFORE UPDATE ON public.bot_menus
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS agent_user_id uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS agent_name text;

GRANT UPDATE ON public.conversations TO authenticated;

CREATE POLICY "Authenticated update conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS matched_knowledge_category text;
CREATE INDEX IF NOT EXISTS messages_matched_knowledge_category_idx ON public.messages (matched_knowledge_category) WHERE matched_knowledge_category IS NOT NULL;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS current_menu_path text,
  ADD COLUMN IF NOT EXISTS survey_sent_at timestamp with time zone;

CREATE POLICY "Authenticated upload knowledge documents files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'knowledge-documents');
CREATE POLICY "Authenticated delete knowledge documents files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'knowledge-documents');
CREATE POLICY "Authenticated read knowledge documents files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'knowledge-documents');
CREATE POLICY "Authenticated update knowledge documents files" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'knowledge-documents') WITH CHECK (bucket_id = 'knowledge-documents');

CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instansi_name text NOT NULL DEFAULT 'Pemerintah Kabupaten Purworejo',
  logo_url text,
  jam_buka text NOT NULL DEFAULT '08:00',
  jam_tutup text NOT NULL DEFAULT '15:30',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read app settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owners insert app settings" ON public.app_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners update app settings" ON public.app_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (instansi_name, jam_buka, jam_tutup) VALUES ('Pemerintah Kabupaten Purworejo', '08:00', '15:30');

CREATE POLICY "Authenticated read app assets" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'app-assets');

CREATE POLICY "Owners upload app assets" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners update app assets" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Owners delete app assets" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'app-assets' AND public.has_role(auth.uid(), 'owner'::app_role));

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS awaiting_operator_confirmation boolean NOT NULL DEFAULT false;

CREATE TABLE public.conversation_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  chatera_conversation_id text,
  from_status text,
  to_status text,
  source text NOT NULL DEFAULT 'system',
  actor text,
  assignee_chatera_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.conversation_status_events TO authenticated;
GRANT ALL ON public.conversation_status_events TO service_role;

ALTER TABLE public.conversation_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read status events"
ON public.conversation_status_events
FOR SELECT TO authenticated
USING (true);

CREATE INDEX conversation_status_events_created_at_idx
  ON public.conversation_status_events (created_at DESC);
CREATE INDEX conversation_status_events_conversation_idx
  ON public.conversation_status_events (conversation_id);

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS bot_engine text NOT NULL DEFAULT 'keyword';

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_bot_engine_check;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_bot_engine_check
  CHECK (bot_engine IN ('keyword', 'ai_external'));