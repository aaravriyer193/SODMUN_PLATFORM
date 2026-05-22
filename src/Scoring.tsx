import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './api';
import { useAuth } from './AuthContext';

const INITIAL_ROWS = 100;
const COLS = 20;
const DEFAULT_COL_WIDTH = 160;
const DEFAULT_ROW_HEIGHT = 40;
const COL_LABELS = Array.from({ length: COLS }, (_, i) => String.fromCharCode(65 + i));

export default function Scoring() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [grid, setGrid] = useState<string[][]>([]);
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving'>('saved');
  const [colWidths, setColWidths] = useState<number[]>(new Array(COLS).fill(DEFAULT_COL_WIDTH));
  const [rowHeights, setRowHeights] = useState<number[]>(new Array(INITIAL_ROWS).fill(DEFAULT_ROW_HEIGHT));
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [formulaBarValue, setFormulaBarValue] = useState('');

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { if (authUser) fetchCoreData(); }, [authUser]);

  const fetchCoreData = async () => {
    const { data: userData } = await supabase.from('users').select('*').eq('id', authUser?.id).single();
    if (userData) {
      setProfile(userData);
      const { data: roster } = await supabase.from('users').select('delegation').eq('committee', userData.committee).eq('role', 'Delegate').order('delegation', { ascending: true });
      const { data: sheetData } = await supabase.from('scoring_sheets').select('*').eq('committee', userData.committee).single();

      let finalGrid: string[][];
      let widths = [...colWidths];
      let heights = [...rowHeights];

      if (sheetData?.grid) {
        finalGrid = sheetData.grid;
        roster?.forEach((d, i) => {
          const tr = i + 1;
          if (finalGrid[tr] && (!finalGrid[tr][0] || finalGrid[tr][0] === '')) finalGrid[tr][0] = d.delegation;
        });
        if (sheetData.metadata?.colWidths?.length > 0) widths = sheetData.metadata.colWidths.map((w: number) => Math.max(w, 60));
        if (sheetData.metadata?.rowHeights?.length > 0) heights = sheetData.metadata.rowHeights.map((h: number) => Math.max(h, 30));
      } else {
        finalGrid = Array.from({ length: INITIAL_ROWS }, (_, rIdx) => Array.from({ length: COLS }, (_, cIdx) => (cIdx === 0 && rIdx > 0 && roster?.[rIdx - 1]) ? roster[rIdx - 1].delegation : ''));
        finalGrid[0][0] = 'DELEGATION';
      }

      setGrid(finalGrid);
      setColWidths(widths);
      setRowHeights(heights);
      setSyncStatus('saved');
    }
  };

  const atomicPush = async (newGrid: string[][], widths: number[], heights: number[]) => {
    if (!profile?.committee) return;
    await supabase.from('scoring_sheets').upsert({ committee: profile.committee, grid: newGrid, metadata: { colWidths: widths, rowHeights: heights }, last_updated_at: new Date().toISOString() });
    setSyncStatus('saved');
  };

  const debouncedPush = (newGrid: string[][], widths: number[], heights: number[]) => {
    setSyncStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => atomicPush(newGrid, widths, heights), 800);
  };

  const handleCellChange = (r: number, c: number, val: string) => {
    const ng = [...grid]; ng[r] = [...ng[r]]; ng[r][c] = val;
    setGrid(ng);
    if (selectedCell?.r === r && selectedCell?.c === c) setFormulaBarValue(val);
    debouncedPush(ng, colWidths, rowHeights);
  };

  const handleCellSelect = (r: number, c: number) => {
    setSelectedCell({ r, c });
    setFormulaBarValue(grid[r]?.[c] || '');
  };

  const handleFormulaBarChange = (val: string) => {
    setFormulaBarValue(val);
    if (selectedCell) handleCellChange(selectedCell.r, selectedCell.c, val);
  };

  const handleResize = (type: 'col' | 'row', index: number, size: number) => {
    if (type === 'col') {
      const nw = [...colWidths]; nw[index] = Math.max(60, size); setColWidths(nw); debouncedPush(grid, nw, rowHeights);
    } else {
      const nh = [...rowHeights]; nh[index] = Math.max(30, size); setRowHeights(nh); debouncedPush(grid, colWidths, nh);
    }
  };

  const cellAddr = selectedCell ? `${COL_LABELS[selectedCell.c]}${selectedCell.r + 1}` : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F8F7F5', overflow: 'hidden', fontFamily: "'Manrope', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <style>{`
        .sc-header-cell {
          background: #F1F0EE;
          border: 1px solid #E4E2DE;
          color: #8A8A8A;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          position: relative;
          white-space: nowrap;
          overflow: hidden;
          text-align: center;
          user-select: none;
        }

        .sc-row-num {
          background: #F1F0EE;
          border: 1px solid #E4E2DE;
          color: #ABABAB;
          font-size: 11px;
          font-weight: 600;
          text-align: center;
          position: sticky;
          left: 0;
          z-index: 90;
          user-select: none;
          position: relative;
        }

        .sc-cell {
          border: 1px solid #E4E2DE;
          padding: 0;
          margin: 0;
          background: #fff;
          position: relative;
          transition: background 0.1s;
        }

        .sc-cell.selected {
          border-color: #F07C00 !important;
          box-shadow: inset 0 0 0 1px #F07C00;
          z-index: 10;
        }

        .sc-cell-input {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: transparent !important;
          border: none !important;
          color: #27272A !important;
          padding: 0 10px !important;
          font-family: 'Manrope', sans-serif !important;
          font-size: 13px !important;
          outline: none !important;
          resize: none !important;
          border-radius: 0 !important;
          box-sizing: border-box !important;
          display: flex; align-items: center;
          margin: 0 !important;
          line-height: ${DEFAULT_ROW_HEIGHT}px;
        }

        .sc-cell-input.is-header {
          font-weight: 700 !important;
          color: #F07C00 !important;
          font-size: 11px !important;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .sc-cell-input.is-delegation {
          font-weight: 600 !important;
          color: #18181B !important;
        }

        .sc-resizer-v {
          position: absolute;
          right: 0; top: 0; bottom: 0;
          width: 5px;
          cursor: col-resize;
          z-index: 150;
          transition: background 0.15s;
        }
        .sc-resizer-v:hover { background: #F07C00; }

        .sc-resizer-h {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 4px;
          cursor: row-resize;
          z-index: 150;
          transition: background 0.15s;
        }
        .sc-resizer-h:hover { background: #F07C00; }

        .sc-sticky-col {
          position: sticky;
          left: 45px;
          z-index: 85;
          background: #FAFAF8 !important;
          border-right: 2px solid #E4E2DE !important;
        }

        .sc-sticky-header {
          position: sticky;
          top: 0;
          z-index: 100;
        }
      `}</style>

      {/* Title bar — Google Sheets style */}
      <div style={{ height: '56px', padding: '0 24px', borderBottom: '1px solid #E4E2DE', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', background: 'rgba(240,124,0,0.10)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F07C00" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: '14px', color: '#18181B' }}>Scoring Sheet</span>
            <span style={{ fontSize: '12px', color: '#A1A1AA', fontWeight: 500 }}>— {profile?.committee}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: syncStatus === 'saved' ? '#22C55E' : '#F07C00', transition: 'background 0.3s' }} />
          <span style={{ fontSize: '11px', color: '#A1A1AA', fontWeight: 500 }}>{syncStatus === 'saved' ? 'All changes saved' : 'Saving…'}</span>
        </div>
      </div>

      {/* Formula bar */}
      <div style={{ height: '36px', padding: '0 16px', borderBottom: '1px solid #E4E2DE', display: 'flex', alignItems: 'center', gap: '10px', background: '#FAFAF8', flexShrink: 0 }}>
        <div style={{ width: '60px', height: '24px', background: '#fff', border: '1px solid #E4E2DE', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#71717A', flexShrink: 0 }}>
          {cellAddr || 'A1'}
        </div>
        <div style={{ width: '1px', height: '20px', background: '#E4E2DE' }} />
        <input
          value={formulaBarValue}
          onChange={e => handleFormulaBarChange(e.target.value)}
          placeholder="Cell value"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', color: '#27272A', fontFamily: 'Manrope, sans-serif', fontWeight: 500, padding: 0, marginBottom: 0 }}
        />
      </div>

      {/* Sheet viewport */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: 'max-content', borderSpacing: 0 }}>
          <thead>
            <tr style={{ height: '32px' }}>
              <th className="sc-header-cell sc-sticky-header" style={{ width: '45px', position: 'sticky', top: 0, left: 0, zIndex: 200 }}>#</th>
              {COL_LABELS.map((l, i) => (
                <th key={l} className={`sc-header-cell sc-sticky-header ${i === 0 ? 'sc-sticky-col' : ''}`} style={{ width: `${colWidths[i]}px`, left: i === 0 ? '45px' : undefined }}>
                  {l}
                  <div className="sc-resizer-v" onMouseDown={e => {
                    const startX = e.pageX; const startW = colWidths[i];
                    const onMove = (mE: MouseEvent) => handleResize('col', i, startW + (mE.pageX - startX));
                    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
                    e.preventDefault();
                  }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, rIdx) => (
              <tr key={rIdx} style={{ height: `${rowHeights[rIdx]}px` }}>
                <td className="sc-row-num" style={{ width: '45px', height: `${rowHeights[rIdx]}px`, fontSize: '11px' }}>
                  {rIdx + 1}
                  <div className="sc-resizer-h" onMouseDown={e => {
                    const startY = e.pageY; const startH = rowHeights[rIdx];
                    const onMove = (mE: MouseEvent) => handleResize('row', rIdx, startH + (mE.pageY - startY));
                    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
                    e.preventDefault();
                  }} />
                </td>
                {row.map((cell, cIdx) => {
                  const isSelected = selectedCell?.r === rIdx && selectedCell?.c === cIdx;
                  return (
                    <td key={cIdx} className={`sc-cell ${isSelected ? 'selected' : ''} ${cIdx === 0 ? 'sc-sticky-col' : ''}`} style={{ left: cIdx === 0 ? '45px' : undefined }}
                      onClick={() => handleCellSelect(rIdx, cIdx)}>
                      <textarea
                        className={`sc-cell-input ${rIdx === 0 ? 'is-header' : ''} ${cIdx === 0 ? 'is-delegation' : ''}`}
                        value={cell || ''}
                        onChange={e => handleCellChange(rIdx, cIdx, e.target.value)}
                        spellCheck={false}
                        rows={1}
                        style={{ lineHeight: `${rowHeights[rIdx]}px` }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}