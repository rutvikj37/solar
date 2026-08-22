let reportData: any = null;

if (typeof window !== 'undefined') {
  const saved = window.localStorage.getItem('solar-report-data');
  if (saved) {
    try {
      reportData = JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse report data', e);
    }
  }
}

export const setReportData = (data: any) => {
  reportData = data;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('solar-report-data', JSON.stringify(data));
  }
};

export const getReportData = () => {
  return reportData;
};
