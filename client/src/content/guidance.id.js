/** The Indonesian of guidance.en.js, in the same shape: change the user's Guidelines doc first, then both. */

export const SECTION_INTROS = {
  kos: 'Mulai dari yang dasar: nama, harga sewa, tipe, dan lokasi. Inilah dasar untuk membandingkan setiap kos.',
  room: 'Catat kamar yang kamu survei: ukuran, fasilitas, dan kondisinya lewat foto. Tulis apa yang kamu lihat hari itu.',
  bathroom: 'Catat jenis kamar mandi, toilet, air panas, dan kondisinya untuk menilai seberapa nyaman.',
  shared: 'Catat fasilitas yang dipakai bersama penghuni untuk kebutuhan sehari-hari, termasuk Wi-Fi.',
  surroundings: 'Catat tempat berguna dalam 10 menit jalan kaki dari kos.',
  additional: 'Tambahkan hal lain yang memengaruhi pilihanmu: keamanan, catatan, dan video.',
};

export const PANEL_PARTS = [
  ['what', 'Yang diisi'],
  ['find', 'Cara mencarinya'],
  ['example', 'Contoh'],
  ['rules', 'Aturan'],
  ['tip', 'Tips survei'],
];

const PHOTO_HELPER = 'Hingga 10 foto, maks. 10 MB per foto.';
const PHOTO_RULES = 'Opsional. Hingga 10 foto, maks. 10 MB per foto.';
const PHOTO_FIND = 'Ambil di lokasi, mengikuti saran foto di bawah.';
const SIZE_HELPER = 'Dalam meter, 1–10. Pilih dari daftar atau ketik, mis. 2.5.';

const ROOM_SIZE_PANEL = {
  what: 'Ukuran lantai kamar, dalam meter.',
  find: 'Ukur lantai dari dinding ke dinding dengan meteran, atau tanya pemilik.',
  example: 'Kamar 3 × 4 m: pilih 3 untuk panjang dan 4 untuk lebar. Untuk pecahan meter, ketik dengan titik, mis. 2.5.',
  rules: 'Opsional. 1–10 m, pakai titik untuk desimal. Daftar berisi meter bulat dari 1 sampai 10; ketik ukuran di antaranya.',
  tip: 'Jangan ikut menghitung kamar mandi dalam.',
};

const COORDINATES_EXAMPLE =
  'Peta tidak muncul? Masukkan koordinat: di Google Maps, tekan lama titiknya lalu salin angkanya, mis. -7.7713, 110.3775.';

export const FIELD_GUIDE = {
  // 1. Kos information
  name: {
    label: 'Nama kos',
    helper: 'Nama di papan nama atau iklan. Maks. 80 karakter.',
    counter: 80,
    panel: {
      what: 'Nama di papan nama atau iklan.',
      find: 'Lihat papan nama, Mamikos, media sosial, atau tanya pemilik.',
      example: 'Kos Melati Pogung. Tidak ada nama resmi? Pakai nama pemilik dan jalannya, mis. Kos Bu Sri – Jl. Kaliurang.',
      rules: 'Wajib, bahkan untuk draf. Maks. 80 karakter.',
    },
  },
  rent: {
    label: 'Harga sewa bulanan',
    helper: 'Per bulan. Geser s.d. Rp10.000.000, atau ketik s.d. Rp100.000.000.',
    panel: {
      what:
        'Harga sewa per bulan dalam rupiah, untuk kamar yang kamu survei. Geser ke jumlahnya atau ketik persisnya; slider berhenti di Rp10.000.000.',
      find: 'Tanya pemilik. Jika harga tergantung tipe kamar atau fasilitas, masukkan harga kamar yang kamu survei.',
      example: 'Dibayar per semester atau per tahun? Bagi dengan jumlah bulannya, mis. Rp9.000.000/tahun = Rp750.000.',
      rules: 'Wajib untuk publikasi. Maks. Rp100.000.000.',
      tip: 'Jika listrik sudah termasuk, centang Termasuk listrik di Fasilitas kamar.',
    },
  },
  type: {
    label: 'Tipe kos',
    helper: 'Siapa yang boleh menyewa di sini.',
    panel: {
      what: 'Siapa yang boleh menyewa di sini.',
      find: 'Tanya pemilik; jangan menebak dari penghuni yang kamu lihat.',
      example: 'Putra: khusus laki-laki. Putri: khusus perempuan. Campur: laki-laki dan perempuan.',
      rules: 'Wajib untuk publikasi. Pilih satu.',
    },
  },
  contactPhone: {
    label: 'Telepon pemilik atau penjaga',
    helper: 'Nomor untuk menghubungi pemilik atau penjaga di lokasi.',
    panel: {
      what: 'Nomor telepon untuk menghubungi pemilik kos, atau penjaga atau pengelola di lokasi.',
      find: 'Tanya pemilik atau penghuni, atau lihat papan nama atau iklannya.',
      example: 'Nomor HP atau WhatsApp, mis. 0812-3456-7890.',
      rules: 'Opsional.',
    },
  },
  kosLocation: {
    label: 'Pin lokasi kos',
    helper: 'Cari alamatnya, lalu taruh pin di pintu masuk kos.',
    panel: {
      what: 'Lokasi kos, dengan pin di pintu masuknya.',
      find: 'Cari alamatnya, lalu geser pin ke gerbang atau pintu depan.',
      example: COORDINATES_EXAMPLE,
      rules: 'Wajib untuk publikasi.',
      tip: 'Jarak ke kampus diukur dari pin ini, jadi taruh dengan cermat.',
    },
  },
  campusLocation: {
    label: 'Pin lokasi kampus',
    helper: 'Pin kampusmu untuk menghitung jarak.',
    panel: {
      what: 'Tujuan harianmu, di-pin untuk menghitung jarak.',
      find: 'Pin gerbang atau gedung yang paling sering kamu datangi, bukan tengah kampus.',
      example: COORDINATES_EXAMPLE,
      rules: 'Opsional. Tanpanya, jarak tidak dihitung.',
    },
  },
  distance: {
    label: 'Jarak ke kampus',
    panel: {
      what: 'Jarak jalan kaki menyusuri jalan dari pin kos ke pin kampus.',
      find: 'Terisi sendiri setelah kedua pin dipasang. Untuk mengubahnya, geser salah satu pin.',
      rules:
        'Hanya-baca. Diukur menurut rute jalan kaki, bukan garis lurus. Jika rute tidak bisa diukur, garis lurus ditampilkan sebagai gantinya dan diberi tanda.',
    },
  },

  // 2. Room
  lengthM: {
    label: 'Panjang kamar',
    helper: SIZE_HELPER,
    panel: ROOM_SIZE_PANEL,
  },
  widthM: {
    label: 'Lebar kamar',
    helper: SIZE_HELPER,
    panel: ROOM_SIZE_PANEL,
  },
  roomFacility: {
    label: 'Fasilitas kamar',
    helper: 'Centang semua yang ada di kamar. Kosong berarti tidak ada.',
    panel: {
      what: 'Semua yang ada di kamar dan siap dipakai.',
      find: 'Periksa sekeliling kamar, dan centang hanya yang ada dan siap dipakai.',
      example:
        'Termasuk listrik: centang jika harga sewa sudah termasuk listrik (tanpa token atau tagihan terpisah). ' +
        'Jendela: centang jika terbuka ke luar, bukan sekadar ventilasi.',
      rules: 'Opsional. Tidak dicentang berarti tidak ada.',
    },
  },
  cleanliness: {
    label: 'Kebersihan',
    helper: 'Nilai kamar sesuai kondisinya hari ini, 1–4.',
    panel: {
      what: 'Seberapa bersih kamar hari ini, dalam skala 1–4.',
      find: 'Periksa lantai, sudut, kolong kasur, dinding (jamur atau lembap), dan baunya.',
      example: 'Lantai, dinding, dan perabot bersih, hanya sedikit aus: 3 Baik.',
      rules: 'Wajib untuk publikasi. Pilih 1–4, sesuaikan yang kamu lihat dengan skornya.',
      tip: 'Nilai yang kamu lihat, bukan yang dijanjikan pemilik untuk dibersihkan.',
    },
  },
  internet: {
    label: 'Kualitas internet',
    helper: 'Tes di dalam kamar, lalu nilai 1–4.',
    panel: {
      what: 'Seberapa baik internet di dalam kamar, dalam skala 1–4.',
      find: 'Jalankan Speedtest by Ookla (aplikasi atau speedtest.net) 3 kali di dalam kamar, bukan di lobi atau di dekat router.',
      example: 'Rata-rata Download 15 Mbps: 3 Baik.',
      rules: 'Wajib untuk publikasi. Sesuaikan rata-rata Download dengan skornya.',
      tip: 'Tidak ada Wi-Fi kos? Tes dan nilai data selulermu, lalu sebutkan di Catatan tambahan.',
    },
  },
  roomPhotos: {
    label: 'Foto kamar',
    helper: PHOTO_HELPER,
    panel: {
      what: 'Foto kamar sesuai kondisinya hari itu.',
      find: PHOTO_FIND,
      rules: PHOTO_RULES,
      tip: 'Ambil foto pada siang hari dengan lampu kamar menyala.',
    },
    photos: [
      'Foto lebar dari pintu',
      'Kasur',
      'Lemari',
      'Meja',
      'Lantai',
      'Dinding',
      'Jendela',
      'Pencahayaan',
      'Setiap fasilitas yang dicentang',
    ],
  },

  // 3. Bathroom
  bathroomType: {
    label: 'Jenis kamar mandi',
    helper: 'Dalam: di dalam kamarmu. Luar: di luar kamar, biasanya bersama.',
    panel: {
      what: 'Letak kamar mandi: di dalam kamar, atau di luarnya.',
      find: 'Periksa sendiri letak kamar mandinya.',
      example: 'Dalam: di dalam kamarmu, hanya untukmu. Luar: di luar kamar, biasanya dipakai bersama penghuni lain.',
      rules: 'Opsional. Pilih satu.',
      tip: 'Jika ada keduanya, pilih Dalam dan sebutkan yang di luar di Catatan tambahan.',
    },
  },
  toiletType: {
    label: 'Jenis toilet',
    helper: 'Jongkok, atau duduk (gaya barat).',
    panel: {
      what: 'Jenis toilet di kamar mandi yang akan kamu pakai.',
      find: 'Lihat di kamar mandi.',
      example: 'Jongkok: menyatu dengan lantai. Duduk: toilet gaya barat dengan dudukan.',
      rules: 'Opsional. Pilih satu.',
      tip: 'Siram untuk memastikan toilet berfungsi dan airnya lancar.',
    },
  },
  waterHeater: {
    label: 'Pemanas air',
    helper: 'Ya hanya jika berfungsi.',
    panel: {
      what: 'Apakah kamar mandi punya air panas.',
      find: 'Nyalakan air panasnya untuk memeriksa.',
      rules: 'Opsional. Ya atau Tidak.',
      tip: 'Pilih Ya hanya jika berfungsi: pemanas yang rusak sama saja dengan tidak ada.',
    },
  },
  bathroomPhotos: {
    label: 'Foto kamar mandi',
    helper: PHOTO_HELPER,
    panel: {
      what: 'Foto kamar mandi sesuai kondisinya hari itu.',
      find: PHOTO_FIND,
      rules: PHOTO_RULES,
      tip: 'Nyalakan keran dan siram toilet untuk memeriksa tekanan dan kejernihan air, lalu catat masalahnya di Catatan tambahan.',
    },
    photos: ['Toilet', 'Shower atau keran', 'Wastafel', 'Lantai dan dinding', 'Saluran air', 'Pemanas air'],
  },

  // 4. Shared facilities
  sharedFacility: {
    label: 'Fasilitas bersama',
    helper: 'Centang yang bisa dipakai semua penghuni. Kosong berarti tidak ada.',
    panel: {
      what: 'Yang bisa dipakai semua penghuni.',
      find: 'Periksa area bersama di lokasi, dan tanya pemilik.',
      example:
        'Wifi: internet dari kos (nilai kualitasnya di bagian Kamar). ' +
        'Parkir motor atau mobil: tempat yang disediakan kos, bukan di jalan. ' +
        'Mesin cuci: mesin yang dipakai sendiri oleh penghuni. ' +
        'Laundry: layanan cuci dari kos, gratis atau berbayar.',
      rules: 'Opsional. Tidak dicentang berarti tidak ada.',
      tip: 'Tempat laundry di dekat kos masuk ke Sekitar, bukan di sini.',
    },
  },
  sharedPhotos: {
    label: 'Foto fasilitas bersama',
    helper: PHOTO_HELPER,
    panel: {
      what: 'Foto ruang yang dipakai bersama penghuni.',
      find: PHOTO_FIND,
      rules: PHOTO_RULES,
    },
    photos: ['Dapur', 'Ruang tamu', 'Tempat jemuran', 'Parkiran', 'Tempat mencuci', 'Ruang bersama lainnya'],
  },

  // 5. Surroundings
  surrounding: {
    label: 'Di sekitar kos',
    helper: 'Centang tempat dalam 10 menit jalan kaki (sekitar 800 m).',
    panel: {
      what: 'Tempat berguna dalam 10 menit jalan kaki (sekitar 800 m).',
      find: 'Jalan kaki di sekitar kos, atau pakai petunjuk jalan kaki Google Maps dari pin kos.',
      example:
        'Warung makan: warung atau rumah makan kecil. ' +
        'Laundry: tempat laundry di dekat kos (layanan dari kos masuk ke Fasilitas bersama).',
      rules: 'Opsional. Tidak dicentang berarti tidak ada di dekat kos.',
    },
  },
  worship: {
    label: 'Tempat ibadah terdekat',
    helper: 'Centang setiap yang ada dalam 10 menit jalan kaki (sekitar 800 m).',
    panel: {
      what: 'Tempat ibadah dalam 10 menit jalan kaki (sekitar 800 m).',
      find: 'Jalan kaki di sekitar kos, atau cari di Google Maps dekat pin kos.',
      example: 'Masjid, gereja, pura, vihara atau klenteng: centang setiap yang dekat.',
      rules: 'Opsional. Tidak dicentang berarti tidak ada di dekat kos.',
    },
  },

  // 6. Additional information
  security: {
    label: 'Keamanan',
    helper: 'Nilai seberapa aman kos terasa, 1–4.',
    panel: {
      what: 'Seberapa aman kos terasa, dalam skala 1–4.',
      find:
        'Periksa gerbang dan kunci kamar, penerangan jalan masuk, CCTV, apakah pemilik atau penjaga tinggal di lokasi, dan aturan tamu.',
      example: 'Gerbang dan kamar bisa dikunci, jalan masuk terang, dan ada CCTV: 3 Baik.',
      rules: 'Wajib untuk publikasi. Pilih 1–4, sesuaikan yang kamu lihat dengan skornya.',
      tip: 'Tanya penghuni yang tinggal di sana jika bisa.',
    },
  },
  notes: {
    label: 'Catatan tambahan',
    helper: 'Hal lain yang perlu diingat. Maks. 1.000 karakter.',
    counter: 1000,
    panel: {
      what: 'Hal lain yang perlu diingat.',
      find: 'Tanya pemilik, dan tulis yang kamu perhatikan di lokasi.',
      example:
        'Biaya tambahan (listrik, air, parkir, laundry), deposit dan cara bayar, jam malam dan aturan tamu, ' +
        'kebisingan, tekanan air, kontak pemilik, dan kesan keseluruhanmu.',
      rules: 'Opsional. Maks. 1.000 karakter.',
    },
  },
  videos: {
    label: 'Video',
    helper: 'Hingga 2 video, maks. 20 MB per video.',
    panel: {
      what: 'Video singkat tentang kos.',
      find: 'Rekam di lokasi.',
      example: 'Tur kamar singkat: berjalan dari pintu mengelilingi kamar dalam sekitar 15 detik.',
      rules: 'Opsional. Hingga 2 video, maks. 20 MB per video.',
      tip: 'Jika file terlalu besar, turunkan resolusi kamera.',
    },
  },
};

export const RUBRICS = {
  cleanliness: [
    { score: 1, label: 'Buruk', text: 'Ada kotoran atau noda yang terlihat, bau tidak sedap, jamur, atau tanda hama.' },
    { score: 2, label: 'Cukup', text: 'Bisa dipakai, tapi berdebu atau bernoda di beberapa bagian. Perlu dibersihkan dulu sebelum pindah.' },
    { score: 3, label: 'Baik', text: 'Lantai, dinding, dan perabot bersih. Hanya sedikit aus.' },
    { score: 4, label: 'Sangat baik', text: 'Bersih sekali, wangi, dan terlihat terawat.' },
  ],
  internet: [
    { score: 1, label: 'Buruk', text: 'Tidak ada sinyal, atau halaman nyaris tidak terbuka dan sering putus.', benchmark: '< 3 Mbps' },
    { score: 2, label: 'Cukup', text: 'Chat dan browsing lancar; video HD dan video call kadang tersendat.', benchmark: '3–10 Mbps' },
    { score: 3, label: 'Baik', text: 'Video HD dan video call lancar.', benchmark: '10–25 Mbps' },
    { score: 4, label: 'Sangat baik', text: 'Cepat dan stabil, bahkan dengan beberapa perangkat atau unduhan besar.', benchmark: '> 25 Mbps' },
  ],
  security: [
    { score: 1, label: 'Buruk', text: 'Tidak ada gerbang atau kunci yang berfungsi, jalan masuk gelap, dan siapa pun bisa masuk.' },
    { score: 2, label: 'Cukup', text: 'Kamar bisa dikunci, tapi jalan masuk terbuka atau kurang terang. Tidak ada CCTV atau pemilik di lokasi.' },
    { score: 3, label: 'Baik', text: 'Gerbang dan kamar bisa dikunci, jalan masuk terang, serta ada CCTV atau pemilik di lokasi.' },
    { score: 4, label: 'Sangat baik', text: 'Berlapis: gerbang terkunci, CCTV, pemilik atau penjaga di lokasi, dan aturan tamu yang jelas.' },
  ],
};

export const SURVEY_GUIDE = {
  title: 'Panduan survei',
  sections: [
    {
      heading: 'Bawa',
      items: ['Meteran, atau aplikasi pengukur', 'HP yang terisi daya, dengan ruang untuk foto dan video', 'Aplikasi Speedtest by Ookla'],
    },
    {
      heading: 'Tanya pemilik',
      items: [
        'Harga per bulan, dan apa saja yang sudah termasuk (listrik, air, Wi-Fi)',
        'Tipe kos',
        'Deposit dan periode pembayaran',
        'Jam malam dan aturan tamu',
        'Biaya tambahan',
      ],
    },
    {
      heading: 'Di lokasi',
      ordered: true,
      items: [
        'Simpan draf begitu kamu tahu nama kosnya.',
        'Isi sisanya sambil berkeliling.',
        'Publikasikan setelah semua kolom wajib terisi.',
      ],
    },
  ],
};
