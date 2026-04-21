# ETA Update Dashboard — Next.js

Dashboard PMT Spare Parts dengan fitur edit inline langsung ke Google Sheets.

## Setup Vercel Environment Variables

Di Vercel → Project Settings → Environment Variables, tambahkan:

| Name | Value |
|------|-------|
| `SHEET_ID` | `1CFZI3vxPElDOrnr3-BmoPm2pCce7igOpzWQmsvCa3bo` |
| `SHEET_TAB` | `ETA DATA` |
| `GOOGLE_CLIENT_EMAIL` | `eta-dashboard-writer@dashboard-eta.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | *(isi seluruh private key dari file JSON, termasuk -----BEGIN PRIVATE KEY-----)* |
| `DASHBOARD_PASSWORD` | `eta2026pmt` *(ganti sesuai keinginan)* |

## Cara Deploy

1. Upload folder ini ke GitHub repo baru
2. Connect repo ke Vercel
3. Tambahkan Environment Variables di atas
4. Deploy

## Fitur
- ✅ Baca data dari Google Sheets secara real-time
- ✅ Edit inline: klik sel ETA Update / Part Status / Remark langsung di tabel
- ✅ Password protection
- ✅ Filter: PIC, Supplier, Status ETA, Pending WO/DS/ASC, GCCS
- ✅ Export CSV
- ✅ KPI: ETA Belum Lewat & ETA Revise GCCS
