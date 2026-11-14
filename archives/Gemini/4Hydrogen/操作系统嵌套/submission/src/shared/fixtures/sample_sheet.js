// Appendix specification: A1:D4 sample workbook (/Demo/sample.sheet)

export function createSampleSheetContent() {
  return JSON.stringify({
    magic: 'NSSHEET',
    version: 1,
    title: 'sample.sheet',
    cols: 12,
    rows: 30,
    cells: {
      A1: { raw: '项目', bold: true },
      B1: { raw: '数量', bold: true },
      C1: { raw: '单价', bold: true },
      D1: { raw: '小计', bold: true },
      A2: { raw: '项目 A' },
      B2: { raw: '24' },
      C2: { raw: '6' },
      D2: { raw: '=B2*C2' },
      A3: { raw: '项目 B' },
      B3: { raw: '12' },
      C3: { raw: '8' },
      D3: { raw: '=B3*C3' },
      A4: { raw: '项目 C' },
      B4: { raw: '18' },
      C4: { raw: '4' },
      D4: { raw: '=B4*C4' }
    }
  }, null, 2);
}
