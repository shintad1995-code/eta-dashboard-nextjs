'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './page.module.css';

const PAGE_SIZE = 50;
const CANT_PROVIDE_RE = /can't prov/i;

function fmtDate(d) {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length !== 3 || isNaN(parseInt(parts[1]))) return d;
  const [y, m, day] = parts;
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${day} ${months[parseInt(m)-1]} ${y}`;
}

function preprocess(r) {
  const revCount = (r['ETA Revise 2'] ? 2 : 0) || (r['ETA Revise 1'] ? 1 : 0);
  const etaCurrent = r['ETA Update'] || r['ETA Revise 1'] || r['ETA Revise 2'];
  const isCantProvide = etaCurrent && CANT_PROVIDE_RE.test(String(etaCurrent));
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...r,
    revCount,
    etaCurrent,
    isCantProvide,
    revisionStatus: revCount >= 2 ? 'revised2' : revCount === 1 ? 'revised1' : 'current',
    isOverdue: !isCantProvide && !!etaCurrent && etaCurrent < today,
  };
}

function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('eta_auth', '1');
        onLogin();
      } else {
        setError('Password salah. Coba lagi.');
      }
    } catch {
      setError('Gagal terhubung ke server.');
    }
    setLoading(false);
  }

  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginCard}>
        <div className={styles.loginLogo}>
          <span className={styles.loginLogoSub}>PMT · Spare Parts Monitoring</span>
          <span className={styles.loginLogoTitle}>ETA Update Dashboard</span>
        </div>
        <form onSubmit={handleSubmit} className={styles.loginForm}>
          <label className={styles.loginLabel}>Password</label>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            className={styles.loginInput}
            placeholder="Masukkan password..."
            autoFocus
          />
          {error && <div className={styles.loginError}>{error}</div>}
          <button type="submit" className={styles.loginBtn} disabled={loading || !pw}>
            {loading ? 'Memverifikasi...' : 'Masuk →'}
          </button>
        </form>
      </div>
    </div>
  );
}

function EditCell({ value, onSave, type = 'text', placeholder = '', isAuthed = false }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef();

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  async function handleBlur() {
    if (val === (value || '')) { setEditing(false); return; }
    setSaving(true);
    await onSave(val);
    setSaving(false);
    setEditing(false);
  }

  function handleKey(e) {
    if (e.key === 'Enter') inputRef.current?.blur();
    if (e.key === 'Escape') { setVal(value || ''); setEditing(false); }
  }

  if (saving) return <span className={styles.cellSaving}>Menyimpan...</span>;

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKey}
        className={styles.cellInput}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      className={`${styles.cellEditable} ${!value ? styles.cellEmpty : ''} ${!isAuthed ? styles.cellReadonly : ''}`}
      onClick={() => { if (isAuthed) setEditing(true); }}
      title={isAuthed ? 'Klik untuk edit' : ''}
    >
      {value ? (type === 'date' ? fmtDate(value) : value) : <span className={styles.cellPlaceholder}>+ {placeholder}</span>}
      {isAuthed && <span className={styles.editIcon}>✎</span>}
    </span>
  );
}

export default function Dashboard() {
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState([]);
  const [colIdx, setColIdx] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [remarkSearch, setRemarkSearch] = useState('');
  const [picFilter, setPicFilter] = useState('');
  const [supFilter, setSupFilter] = useState('');
  const [revFilter, setRevFilter] = useState('');
  const [pendingFilter, setPendingFilter] = useState('');
  const [gccsFilter, setGccsFilter] = useState('');
const [etaNewFilter, setEtaNewFilter] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('eta_auth');
    if (stored === '1') {
      setAuthed(true);
    } else {
      setLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/data');
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const processed = (json.records || []).map(preprocess);
      setData(processed);
      setColIdx(json.idx || {});
      setLastUpdated(new Date().toLocaleTimeString('id-ID'));
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (authed) loadData(); }, [authed, loadData]);

  useEffect(() => {
    let f = data.filter(r => {
      if (r.isOverdue && !r.isCantProvide) return false;
      if (search && !`${r['Part Code']} ${r['Part Name']} ${r['MODEL']}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (remarkSearch && !`${r['Part Status']||''} ${r['Remark']||''}`.toLowerCase().includes(remarkSearch.toLowerCase())) return false;
      if (picFilter && r['PIC'] !== picFilter) return false;
      if (supFilter && r['Supplier'] !== supFilter) return false;
      if (revFilter && r.revisionStatus !== revFilter) return false;
      if (pendingFilter === 'WO' && r['WO Pending Validation'] !== 'Pending') return false;
      if (pendingFilter === 'DS' && r['DS Pending Validation'] !== 'Pending') return false;
      if (pendingFilter === 'ASC' && r['Pending SO ASC Validation'] !== 'Pending') return false;
if (gccsFilter === 'gccs'   && r['ETA Revise'] !== 'YES') return false;
if (etaNewFilter) {
  const ltVal = parseFloat(r['LT PENDING'] ?? '99');
  if (r['ETA Update'] || ltVal > 1) return false;
}
return true;
      
    });
    setFiltered(f);
    setPage(1);
  }, [data, search, remarkSearch, picFilter, supFilter, revFilter, pendingFilter, gccsFilter]);


async function handleUpdate(rowIndex, field, value) {
  const body = { rowIndex, idx: colIdx };
  if (field === 'ETA Update') body['ETA Update'] = value;
  else if (field === 'partStatus') body['partStatus'] = value;
  else if (field === 'remark') body['remark'] = value;

  const res = await fetch('/api/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();

  if (json.success) {
    // Map field name ke nama kolom di data
    const dataField = field === 'partStatus' ? 'Part Status'
                    : field === 'remark' ? 'Remark'
                    : field;
    setData(prev => prev.map(r =>
      r._rowIndex === rowIndex ? preprocess({ ...r, [dataField]: value || null }) : r
    ));
  }
}
  
  function resetFilters() {
    setSearch(''); setRemarkSearch(''); setPicFilter('');
    setSupFilter(''); setRevFilter(''); setPendingFilter(''); setGccsFilter(''); setEtaNewFilter(false);
  }

  if (!authed && data.length === 0) return <LoginScreen onLogin={() => setAuthed(true)} />;

  const pics = [...new Set(data.map(r => r['PIC']).filter(Boolean))].sort();
  const suppliers = [...new Set(data.map(r => r['Supplier']).filter(Boolean))].sort();
  const overdue = data.filter(r => r.isOverdue).length;
  const gccsCount = data.filter(r => r['ETA Revise'] === 'YES').length;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <div className={styles.headerSub}>PMT · Spare Parts Monitoring</div>
          <div className={styles.headerTitle}>ETA <span>Update</span> Dashboard</div>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.liveBadge}><span className={styles.liveDot}/>Live View</span>
          <span className={styles.dateText}>{new Date().toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</span>
          {lastUpdated && <span className={styles.updatedText}>Data diperbarui: {lastUpdated}</span>}
          <button className={styles.refreshBtn} onClick={loadData}>↺ Refresh</button>
          <button className={styles.exportBtn} onClick={() => exportCSV(filtered)}>↓ Export CSV</button>
          {!authed && (
            <button className={styles.loginBannerBtn} onClick={() => { setData([]); setAuthed(false); }}>
              🔒 Login untuk Edit
            </button>
          )}
          {authed && (
            <button className={styles.logoutBtn} onClick={() => { localStorage.removeItem('eta_auth'); setAuthed(false); setData([]); }}>Keluar</button>
          )}
        </div>
      </header>

      <div className={styles.main}>
        <div className={styles.kpiGrid}>
          <div className={`${styles.kpiCard} ${styles.kpiBlue}`}>
            <div className={styles.kpiIcon}>📋</div>
            <div>
              <div className={styles.kpiLabel}>ETA Belum Lewat</div>
              <div className={styles.kpiValue}>{(data.length - overdue).toLocaleString('id-ID')}</div>
              <div className={styles.kpiSub}>Part aktif ditampilkan</div>
            </div>
          </div>
          <div className={`${styles.kpiCard} ${styles.kpiPurple}`}>
            <div className={styles.kpiIcon}>🔄</div>
            <div>
              <div className={styles.kpiLabel}>ETA Revise GCCS</div>
              <div className={styles.kpiValue}>{gccsCount.toLocaleString('id-ID')}</div>
              <div className={styles.kpiSub}>Kolom ETA Revise = YES</div>
            </div>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.toolbarSection}>
            <label>Cari Part</label>
            <input className={styles.filterInput} placeholder="Part Code / Nama / Model..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className={styles.toolbarSection}>
            <label>Part Status / Remark</label>
            <input className={styles.filterInput} placeholder="Cari status atau remark..." value={remarkSearch} onChange={e => setRemarkSearch(e.target.value)} />
          </div>
          <div className={styles.toolbarDivider} />
          <div className={styles.toolbarSection}>
            <label>PIC</label>
            <select className={styles.filterSelect} value={picFilter} onChange={e => setPicFilter(e.target.value)}>
              <option value="">Semua</option>
              {pics.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className={styles.toolbarSection}>
            <label>Supplier</label>
            <select className={styles.filterSelect} value={supFilter} onChange={e => setSupFilter(e.target.value)}>
              <option value="">Semua</option>
              {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className={styles.toolbarDivider} />
          <div className={styles.toolbarSection}>
            <label>Status ETA</label>
            <div className={styles.toggleGroup}>
              {[['','Semua'],['revised2','⚠ Revisi 2×'],['revised1','△ Revisi 1×'],['current','✓ Baru']].map(([v,l]) => (
                <button key={v} className={`${styles.toggleBtn} ${revFilter===v?styles.active:''}`} onClick={() => setRevFilter(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className={styles.toolbarSection}>
            <label>Pending</label>
            <div className={styles.toggleGroup}>
              {[['','Semua'],['WO','WO'],['DS','DS'],['ASC','ASC']].map(([v,l]) => (
                <button key={v} className={`${styles.toggleBtn} ${pendingFilter===v?styles.active:''}`} onClick={() => setPendingFilter(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className={styles.toolbarSection}>
            <label>GCCS</label>
            <div className={styles.toggleGroup}>
              {[['','Semua'],['gccs','🔄 ETA Revise GCCS']].map(([v,l]) => (
                <button key={v} className={`${styles.toggleBtn} ${gccsFilter===v?styles.active:''}`} onClick={() => setGccsFilter(v)}>{l}</button>
              ))}
            </div>
          </div>
              <div className={styles.toolbarSection}>
  <label>ETA</label>
  <div className={styles.toggleGroup}>
    <button className={`${styles.toggleBtn} ${!etaNewFilter?styles.active:''}`} onClick={() => setEtaNewFilter(false)}>Semua</button>
    <button className={`${styles.toggleBtn} ${etaNewFilter?styles.active:''}`} onClick={() => setEtaNewFilter(true)}>🆕 ETA New</button>
  </div>
</div>
          <button className={styles.clearBtn} onClick={resetFilters}>✕ Reset</button>
        </div>

        <div className={styles.resultsBar}>
          <span className={styles.resultsCount}>
            Menampilkan <strong>{pageData.length}</strong> dari <strong>{filtered.length}</strong> part
          </span>
          <div className={styles.legend}>
            <span className={styles.legendItem}><span className={styles.legendDot} style={{background:'#dc2626'}}/>Revisi 2×</span>
            <span className={styles.legendItem}><span className={styles.legendDot} style={{background:'#d97706'}}/>Revisi 1×</span>
            <span className={styles.legendItem}><span className={styles.legendDot} style={{background:'#059669'}}/>Baru</span>
          </div>
        </div>

        <div className={styles.tableWrap}>
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}/>
              <span>Memuat data dari Google Sheets...</span>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <div>⚠️ Gagal memuat data</div>
              <div className={styles.errorMsg}>{error}</div>
              <button onClick={loadData} className={styles.retryBtn}>↺ Coba lagi</button>
            </div>
          ) : (
            <>
              <div className={styles.tableScroll}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Part Code</th>
                      <th>Nama Part</th>
                      <th>Model</th>
                      <th>PIC</th>
                      <th>Supplier</th>
                      <th>ETA Terkini</th>
                      <th>Revisi History</th>
                      <th>Status Revisi</th>
                      <th>Pending WO</th>
                      <th>Pending DS</th>
                      <th>Pending ASC</th>
                      <th>Part Status</th>
                      <th>Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageData.length === 0 ? (
                      <tr><td colSpan={13} className={styles.emptyState}>
                        <div>🔍</div><p>Tidak ada data yang sesuai filter.</p>
                      </td></tr>
                    ) : pageData.map((r, i) => (
                      <tr key={r['Part Code']+i} className={styles[r.revisionStatus]}>
                        <td><span className={styles.partCode}>{r['Part Code']}</span></td>
                        <td><span className={styles.partName} title={r['Part Name']}>{r['Part Name'] || '—'}</span></td>
                        <td><span className={styles.modelBadge}>{r['MODEL'] || '—'}</span></td>
                        <td>{r['PIC'] ? <span className={`${styles.picBadge} ${styles['pic_'+r['PIC']]}`}>{r['PIC'][0]}</span> : '—'}</td>
                        <td className={styles.supplierCell}>{r['Supplier'] || '—'}</td>
                        <td>
                          <EditCell value={r['ETA Update']} type="date" placeholder="ETA Update" isAuthed={authed} onSave={v => handleUpdate(r._rowIndex, 'ETA Update', v)} />
                        </td>
                        <td>
                          {r['ETA Revise 2'] && <div className={styles.etaOld}>{fmtDate(r['ETA Revise 2'])}</div>}
                          {r['ETA Revise 1'] && <div className={styles.etaOld}>{fmtDate(r['ETA Revise 1'])}</div>}
                          {!r['ETA Revise 1'] && !r['ETA Revise 2'] && <span className={styles.muted}>—</span>}
                        </td>
                        <td>
                          {r.revCount >= 2 && <span className={`${styles.revBadge} ${styles.rev2x}`}>⚠ REVISI 2×</span>}
                          {r.revCount === 1 && <span className={`${styles.revBadge} ${styles.rev1x}`}>△ REVISI 1×</span>}
                          {r.revCount === 0 && <span className={`${styles.revBadge} ${styles.rev0x}`}>✓ TERBARU</span>}
                        </td>
                        <td>{r['WO Pending Validation']==='Pending' ? <span className={styles.pendingBadge}>PENDING</span> : '—'}</td>
                        <td>{r['DS Pending Validation']==='Pending' ? <span className={styles.pendingBadge}>PENDING</span> : '—'}</td>
                        <td>{r['Pending SO ASC Validation']==='Pending' ? <span className={styles.pendingBadge}>PENDING</span> : '—'}</td>
                        <td>
                          <EditCell value={r['Part Status']} placeholder="Part Status" isAuthed={authed} onSave={v => handleUpdate(r._rowIndex, 'partStatus', v)} />
                        </td>
                        <td>
                          <EditCell value={r['Remark']} placeholder="Remark" isAuthed={authed} onSave={v => handleUpdate(r._rowIndex, 'remark', v)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button className={styles.pageBtn} onClick={() => setPage(p => Math.max(1,p-1))} disabled={page===1}>←</button>
                  {Array.from({length: totalPages}, (_,i) => i+1)
                    .filter(p => p===1||p===totalPages||Math.abs(p-page)<=2)
                    .reduce((acc,p,i,arr) => { if(i>0&&arr[i-1]!==p-1) acc.push('...'); acc.push(p); return acc; }, [])
                    .map((p,i) => p==='...'
                      ? <span key={i} className={styles.pageDots}>…</span>
                      : <button key={p} className={`${styles.pageBtn} ${p===page?styles.pageActive:''}`} onClick={() => setPage(p)}>{p}</button>
                    )}
                  <button className={styles.pageBtn} onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page===totalPages}>→</button>
                  <span className={styles.pageInfo}>{((page-1)*PAGE_SIZE)+1}–{Math.min(page*PAGE_SIZE,filtered.length)} / {filtered.length}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function exportCSV(rows) {
  const cols = ['Part Code','Part Name','MODEL','PIC','Supplier','ETA Update','ETA Revise 1','ETA Revise 2','Part Status','Remark'];
  const lines = [cols.join(','), ...rows.map(r => cols.map(c => `"${String(r[c]||'').replace(/"/g,'""')}"`).join(','))];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], {type:'text/csv'}));
  a.download = `ETA_Dashboard_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
    }
