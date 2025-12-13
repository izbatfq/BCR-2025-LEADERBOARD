# Race Leaderboard (TypeScript)

Deploy-ready for CodeSandbox (Vite React TS).  
Features:
- Overall leaderboard
- Category leaderboards (4 kategori: 10K Laki-laki, 10K Perempuan, 5K Laki-Laki, 5K Perempuan)
- EPC strict matching (master + start + finish)
- F1-style Top 10 preview + Full Standings toggle
- Search by NO BIB
- Export CSV (filtered rows)

## Data Input (CSV Upload)
Semua data sekarang berasal dari CSV yang di-upload melalui menu **Admin** (bukan Google Spreadsheet).

### Admin credentials
- Username: `izbat@izbat.org`
- Password: `12345678`

### CSV yang dibutuhkan
- **Master (wajib)**: minimal kolom `EPC`, `Nama`, `Kelamin`, `Kategori`, `BIB` (mis: `BIB Number`)
- **Start (wajib)**: minimal kolom `EPC`, `Times` (atau `Time`/`Timestamp`/`Jam`)
- **Finish (wajib)**: minimal kolom `EPC`, `Times` (atau `Time`/`Timestamp`/`Jam`)
- **Checkpoint (optional)**: minimal kolom `EPC`, `Times` (atau `Time`/`Timestamp`/`Jam`)

Catatan:
- `Kategori` master bisa memakai format seperti `10 KM` / `5 KM` (akan dimapping otomatis sesuai `Kelamin`).
- File CSV disimpan di browser (IndexedDB), jadi tetap ada walaupun halaman direload.

## Event Title
Judul event yang tampil di header bisa diubah dari menu **Admin → Event Settings**.

## Run
```bash
npm install
npm run dev
```

## Embed
Deploy your sandbox and embed the public URL via iframe.

## Debugging missing rows
Open "Debug Panel" at the bottom to see:
- counts from master/start/finish
- EPCs missing in each dataset
