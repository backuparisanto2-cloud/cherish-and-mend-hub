export const KB_CATEGORIES = [
  "PORJO",
  "RSUD & Puskesmas",
  "Disdukcapil",
  "DPMPTSP",
  "BPPKAD",
  "CCTV",
  "Umum",
] as const;

export type KbCategory = (typeof KB_CATEGORIES)[number];

export type KnowledgeEntry = {
  id: string;
  category: KbCategory;
  title: string;
  answer: string;
  keywords: string[];
  active: boolean;
};

export const DUMMY_KNOWLEDGE: KnowledgeEntry[] = [
  { id: "kb-01", category: "PORJO", title: "Cara membuat aduan baru", answer: "Warga dapat membuat aduan melalui portal PORJO dengan melampirkan foto bukti, lokasi kejadian, dan kronologi singkat.", keywords: ["aduan", "lapor", "porjo"], active: true },
  { id: "kb-02", category: "PORJO", title: "Cek status progress aduan", answer: "Login ke portal aduan, buka menu Aduan, pilih aduan Anda, lalu klik tombol komentar untuk melihat balasan dinas.", keywords: ["status", "progress", "aduan"], active: true },
  { id: "kb-03", category: "RSUD & Puskesmas", title: "Jadwal dokter RSUD Tjitrowardojo", answer: "Jadwal dokter dan antrean online dapat diakses melalui aplikasi SIMRS Mobile RSUD dr. Tjitrowardojo.", keywords: ["jadwal", "dokter", "rsud", "antrean"], active: true },
  { id: "kb-04", category: "RSUD & Puskesmas", title: "Kontak dan alamat puskesmas", answer: "Terdapat 27 puskesmas se-Kabupaten Purworejo yang melayani rawat jalan, rawat inap tertentu, dan kegawatdaruratan tingkat pertama.", keywords: ["puskesmas", "alamat", "kontak"], active: true },
  { id: "kb-05", category: "Disdukcapil", title: "Syarat pembuatan Kartu Keluarga", answer: "Pengajuan pembuatan atau perubahan data Kartu Keluarga dilakukan melalui formulir daring Disdukcapil dengan melampirkan dokumen pendukung.", keywords: ["kk", "kartu keluarga", "syarat"], active: true },
  { id: "kb-06", category: "Disdukcapil", title: "Pengajuan Kartu Identitas Anak", answer: "KIA diterbitkan untuk anak di bawah 17 tahun dengan melampirkan akta kelahiran, KK, dan foto anak.", keywords: ["kia", "anak", "identitas"], active: true },
  { id: "kb-07", category: "Disdukcapil", title: "Layanan pindah penduduk", answer: "Layanan pindah jiwa antar Desa, Kecamatan, Kabupaten, atau Provinsi diajukan melalui formulir pindah penduduk.", keywords: ["pindah", "domisili"], active: false },
  { id: "kb-08", category: "DPMPTSP", title: "Perizinan berusaha berbasis risiko (OSS)", answer: "Legalitas usaha terintegrasi elektronik untuk risiko rendah hingga tinggi: NIB, Sertifikat Standar, dan Izin.", keywords: ["oss", "nib", "izin usaha"], active: true },
  { id: "kb-09", category: "DPMPTSP", title: "Surat Izin Praktik tenaga medis", answer: "Penerbitan SIP membutuhkan STR aktif, rekomendasi organisasi profesi, dan surat keterangan tempat praktik.", keywords: ["sip", "dokter", "izin praktik"], active: true },
  { id: "kb-10", category: "DPMPTSP", title: "PBG dan Sertifikat Laik Fungsi", answer: "Pengajuan PBG/SLF memerlukan bukti kepemilikan tanah, gambar rencana teknis, dan data pemilik bangunan.", keywords: ["pbg", "slf", "bangunan"], active: false },
  { id: "kb-11", category: "BPPKAD", title: "Cek tagihan PBB-P2", answer: "Tagihan Pajak Bumi dan Bangunan Perdesaan dan Perkotaan dapat dicek dengan memasukkan NOP pada portal pajak daerah.", keywords: ["pbb", "pajak", "tagihan"], active: true },
  { id: "kb-12", category: "BPPKAD", title: "Pengurusan BPHTB", answer: "Bea Perolehan Hak Atas Tanah dan/atau Bangunan diajukan dengan dokumen akta, SPPT, dan bukti bayar PBB terakhir.", keywords: ["bphtb", "tanah", "bea"], active: true },
  { id: "kb-13", category: "CCTV", title: "Pantau CCTV lewat Lekjo", answer: "Masyarakat dapat memantau CCTV publik melalui website Lekjo (Lensa Kabupaten Purworejo).", keywords: ["cctv", "lekjo", "pantau"], active: true },
  { id: "kb-14", category: "Umum", title: "Jam layanan operator", answer: "Operator melayani Senin sampai Jumat pukul 07.30 - 16.00 WIB melalui helpdesk resmi.", keywords: ["jam kerja", "operator", "helpdesk"], active: true },
  { id: "kb-15", category: "Umum", title: "Cara kembali ke menu utama", answer: "Warga dapat mengetik angka 0 kapan saja untuk kembali ke menu utama chatbot.", keywords: ["menu", "navigasi", "0"], active: true },
];

export type BotMenu = {
  id: string;
  order: number;
  emoji: string;
  label: string;
  template: string;
  category: KbCategory;
};

export const DUMMY_BOT_MENUS: BotMenu[] = [
  { id: "menu-1", order: 1, emoji: "🫵", label: "Aduan & Aspirasi Warga (PORJO)", category: "PORJO", template: "Kategori [1] : Aduan & Aspirasi Warga (PORJO)\n\nSilakan pilih sub kategori:\n[1.1] Panduan & Cara Melapor\n[1.2] Buat Aduan Baru\n[1.3] Cek Status Progress Aduan" },
  { id: "menu-2", order: 2, emoji: "🏥", label: "Layanan Kesehatan (RSUD & Puskesmas)", category: "RSUD & Puskesmas", template: "Kategori [2] : Layanan Kesehatan\n\n[2.1] RSUD dr. Tjitrowardojo Purworejo\n[2.2] Kontak & Alamat Puskesmas" },
  { id: "menu-3", order: 3, emoji: "🪪", label: "Administrasi Kependudukan (Disdukcapil)", category: "Disdukcapil", template: "Kategori [3] : Kependudukan (Disdukcapil)\n\n[3.1] Kartu Keluarga\n[3.2] Pindah Penduduk\n[3.3] Kartu Identitas Anak ... [3.10] Cek Pengajuan" },
  { id: "menu-4", order: 4, emoji: "💼", label: "Perizinan & Usaha (DPMPTSP)", category: "DPMPTSP", template: "Kategori [4] : Perizinan & Usaha (DPMPTSP)\n\n[4.1] Perizinan Berusaha Berbasis Risiko (OSS)\n[4.2] Sektor Pendidikan ... [4.8] Cek Status & Pengaduan" },
  { id: "menu-5", order: 5, emoji: "🏠", label: "Pajak Bumi dan Bangunan (BPPKAD)", category: "BPPKAD", template: "Portal Pajak & Retribusi Daerah (BPKPAD)\n\n[5.1] PBB-P2\n[5.2] PBJT\n[5.3] BPHTB ... [5.6] MBLB & Sarang Burung Walet" },
  { id: "menu-6", order: 6, emoji: "📹", label: "Pantau CCTV Purworejo (Lekjo)", category: "CCTV", template: "Pantau CCTV Online lewat Lekjo\n\nhttps://lekjo.purworejokab.go.id\n\nKetik 0 untuk kembali ke menu utama." },
  { id: "menu-7", order: 7, emoji: "📞", label: "Hubungi Operator (Live Chat Petugas)", category: "Umum", template: "Hubungi Operator (Live Chat Petugas)\n\nAnda akan disambungkan dengan petugas. Jam kerja Senin - Jumat 07.30 - 16.00 WIB." },
];
