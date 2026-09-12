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
