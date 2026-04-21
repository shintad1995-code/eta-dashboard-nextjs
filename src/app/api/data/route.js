import { google } from 'googleapis';

const SHEET_ID  = process.env.SHEET_ID;
const SHEET_TAB = process.env.SHEET_TAB;

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.split('\\n').join('\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export async function GET() {
  try {
    const auth   = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A1:AP30000`,
    });

    const rows    = res.data.values || [];
    const headers = rows[0] || [];
    const dataRows = rows.slice(1);

    const NEEDED = [
      'Part Code','Part Name','MODEL','PIC','Supplier',
      'ETA Update','ETA Revise 1','ETA Revise 2','ETA GCCS',
      'Part Status','Status Pending','Remark','LT PENDING',
      'Shipment Method','Total Pending',
      'WO Pending Validation','DS Pending Validation','Pending SO ASC Validation',
      'ETA Revise',
    ];

    const idx = {};
    headers.forEach((h, i) => { if (h) idx[h.trim()] = i; });

    const CANT_PROVIDE_RE = /can't prov/i;
    const ETA_DATE_COLS   = ['ETA Update','ETA Revise 1','ETA Revise 2','ETA GCCS'];

    const raw = dataRows
      .filter(row => row && row.length > 0 && row[idx['Part Code'] ?? 0])
      .map((row, rowIdx) => {
        const r = { _rowIndex: rowIdx + 2 };
        NEEDED.forEach(col => {
          const i = idx[col];
          const v = i !== undefined ? String(row[i] ?? '').trim() : '';
          r[col] = v || null;
        });

        ETA_DATE_COLS.forEach(col => {
          const v = r[col];
          if (!v || CANT_PROVIDE_RE.test(v)) return;
          if (/^\d{5}$/.test(v)) {
            r[col] = new Date(Math.round((parseFloat(v) - 25569) * 86400 * 1000))
              .toISOString().slice(0, 10);
            return;
          }
          const dmy = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (dmy) {
            r[col] = `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
          }
        });

        return r;
      });

    const records = raw.filter(r =>
      r['WO Pending Validation'] === 'Pending' ||
      r['DS Pending Validation'] === 'Pending' ||
      r['Pending SO ASC Validation'] === 'Pending' ||
      ETA_DATE_COLS.some(c => r[c]) ||
      (r['ETA Update'] && CANT_PROVIDE_RE.test(r['ETA Update']))
    );

    return Response.json({ records, idx });

  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
