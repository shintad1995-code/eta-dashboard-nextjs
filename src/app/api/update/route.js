import { google } from 'googleapis';

const SHEET_ID  = process.env.SHEET_ID;
const SHEET_TAB = process.env.SHEET_TAB;

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64 || '', 'base64').toString('utf8'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function colIndexToLetter(n) {
  let letter = '';
  let i = n + 1;
  while (i > 0) {
    const rem = (i - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    i = Math.floor((i - 1) / 26);
  }
  return letter;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { rowIndex, idx } = body;

    if (!rowIndex) {
      return Response.json({ error: 'rowIndex required' }, { status: 400 });
    }

    const auth   = getAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    const updates = [];

    const etaVal = body['ETA Update'];
    if (etaVal !== undefined) {
      const col = colIndexToLetter(idx?.['ETA Update'] ?? 29);
      updates.push({ range: `${SHEET_TAB}!${col}${rowIndex}`, values: [[etaVal]] });
    }

    const psVal = body['partStatus'] ?? body['Part Status'];
    if (psVal !== undefined) {
      const col = colIndexToLetter(idx?.['Part Status'] ?? 33);
      updates.push({ range: `${SHEET_TAB}!${col}${rowIndex}`, values: [[psVal]] });
    }

    const rmVal = body['remark'] ?? body['Remark'];
    if (rmVal !== undefined) {
      const col = colIndexToLetter(idx?.['Remark'] ?? 36);
      updates.push({ range: `${SHEET_TAB}!${col}${rowIndex}`, values: [[rmVal]] });
    }

    if (updates.length === 0) {
      return Response.json({ error: 'No fields to update', received: Object.keys(body) }, { status: 400 });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
    });

    return Response.json({ success: true, updated: updates.length });

  } catch (err) {
    console.error('Update error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
