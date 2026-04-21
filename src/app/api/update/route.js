import { google } from 'googleapis';

const SHEET_ID  = process.env.SHEET_ID;
const SHEET_TAB = process.env.SHEET_TAB;

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function colIndexToLetter(idx) {
  let letter = '';
  let n = idx + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

export async function POST(request) {
  try {
    const { rowIndex, etaUpdate, partStatus, remark, idx } = await request.json();

    if (!rowIndex) {
      return Response.json({ error: 'rowIndex required' }, { status: 400 });
    }

    const auth   = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const updates = [];

    if (etaUpdate !== undefined) {
      const colLetter = colIndexToLetter(idx['ETA Update'] ?? 29);
      updates.push({ range: `${SHEET_TAB}!${colLetter}${rowIndex}`, values: [[etaUpdate]] });
    }

    if (partStatus !== undefined) {
      const colLetter = colIndexToLetter(idx['Part Status'] ?? 33);
      updates.push({ range: `${SHEET_TAB}!${colLetter}${rowIndex}`, values: [[partStatus]] });
    }

    if (remark !== undefined) {
      const colLetter = colIndexToLetter(idx['Remark'] ?? 36);
      updates.push({ range: `${SHEET_TAB}!${colLetter}${rowIndex}`, values: [[remark]] });
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
    });

    return Response.json({ success: true, updated: updates.length });

  } catch (err) {
    console.error(err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
