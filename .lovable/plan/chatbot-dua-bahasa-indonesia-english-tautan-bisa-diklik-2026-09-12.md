# Chatbot Dua Bahasa (Indonesia & English) + Tautan Bisa Diklik

Chatbot WhatsApp akan mendukung dua bahasa. Bahasa Indonesia tetap default; warga bisa berpindah ke English lewat menu/perintah. Halaman admin tetap berbahasa Indonesia (sesuai pilihan Anda), tapi tautan di riwayat chat ikut dibuat bisa diklik.

## 1. Pilihan bahasa di WhatsApp

- Menu utama mendapat satu baris pilihan bahasa, misalnya `[9] English / Bahasa Indonesia`.
- Perintah teks juga diterima: `english`, `en`, `bahasa`, `indonesia`, `id`.
- Pilihan bahasa disimpan per nomor/percakapan, jadi semua balasan berikutnya (menu, jawaban AI, pesan tunggu operator, survei penutup) memakai bahasa itu sampai warga menggantinya.
- Setelah memilih, bot mengirim konfirmasi singkat lalu menampilkan menu utama dalam bahasa baru.

## 2. Terjemahan yang natural, istilah pemerintahan tetap Indonesia

Aturan penulisan mode English:
- Nama dokumen dan lembaga resmi tetap dalam bahasa Indonesia, diikuti istilah Inggris dalam kurung pada kemunculan pertama di satu pesan:
  - KTP (national ID card)
  - Kartu Keluarga (family card)
  - Akta Kelahiran (birth certificate)
  - Kartu Identitas Anak (child identity card)
  - Nama dinas (Disdukcapil, DPMPTSP, BPKPAD, Puskesmas, RSUD) tetap apa adanya, dengan penjelasan singkat dalam kurung.
- URL, email, nomor telepon/WA, kode menu, dan angka tidak pernah diterjemahkan atau diubah.
- Emoji, penomoran menu, dan struktur pesan dipertahankan agar tampilan identik dengan versi Indonesia.

Teks menu tersimpan dalam bahasa Indonesia di database. Versi English dibuat otomatis lewat AI dengan aturan di atas, lalu disimpan (cache) supaya cepat, konsisten, dan hemat. Jika teks Indonesia diubah dari halaman Menu Bot, versi English otomatis dibuat ulang saat pertama kali dibutuhkan. Jika AI sedang tidak tersedia, bot mengirim teks Indonesia agar warga tidak kehilangan informasi.

Jawaban AI dari knowledge base juga akan mengikuti bahasa aktif percakapan dengan aturan istilah yang sama.

## 3. Tautan bisa diklik

Untuk pesan WhatsApp keluar:
- Tautan bergaya markdown `[teks](https://...)` diubah menjadi `teks: https://...` agar benar-benar bisa diklik di WhatsApp.
- Placeholder seperti `[Link Form Kutipan Kedua]` yang belum berisi URL akan ditandai jelas agar tidak tampil sebagai tautan mati.
- Email dan nomor telepon dinormalkan (nomor jadi format internasional `+62…`) sehingga WhatsApp otomatis menjadikannya bisa disentuh.
- Penebalan disesuaikan ke format WhatsApp (`*tebal*`), bukan `**tebal**`.

Untuk riwayat chat di halaman admin: URL, email, dan nomor telepon/WA ditampilkan sebagai tautan yang bisa diklik (buka tab baru, `mailto:`, `tel:`/wa.me).

## Rincian teknis

- Migration: tambah kolom `language` (`text`, default `'id'`) pada `conversations`; tambah tabel cache terjemahan (`bot_menu_translations`: `menu_path`, `language`, `source_hash`, `body`, timestamps) dengan GRANT + RLS (baca `authenticated`, tulis `service_role`).
- `src/lib/bot-menu-tree.ts`: tambah command bahasa (`LANGUAGE_COMMANDS`), parameter `language` pada `renderMenu`/`resolveMenuReply`, dan string tetap (BACK_HOME, HELP_HINT, UNKNOWN_PREFIX, bantuan) untuk `id` dan `en`.
- `src/lib/chatera-bot.server.ts`: baca/simpan bahasa percakapan, terjemahkan body menu via cache + JTG AI (prompt glossary), lokalkan `CLOSING_SURVEY_TEXT` dan pesan operator, dan lewatkan semua teks keluar melalui sanitizer baru sebelum dikirim.
- Berkas baru `src/lib/whatsapp-format.ts` (murni, dapat diuji): konversi markdown → format WhatsApp + normalisasi URL/email/telepon.
- Berkas baru `src/lib/linkify.tsx` dipakai di bubble pesan inbox admin untuk menautkan URL/email/telepon.
- `src/lib/auto-close.server.ts`: kirim survei penutup sesuai bahasa percakapan.
