/**
 * Utility functions for Nepal Fiscal Year (आर्थिक वर्ष)
 * 
 * Nepal's Fiscal Year runs from Shrawan 1 to Ashad End (approx July 16/17 to July 15/16).
 * BS Year = AD Year + 57 (approx)
 */

export interface FiscalYearInfo {
  bsStartYear: number;       // e.g. 2081
  bsEndYear: number;         // e.g. 2082
  shortCode: string;         // e.g. "81/82" or "81-82"
  labelEn: string;           // e.g. "FY 2081/82"
  labelNp: string;           // e.g. "आ.व. २०८१/८२"
  fullLabel: string;         // e.g. "आ.व. २०८१/८२ (FY 2081/82)"
  startDate: Date;           // approx July 16 of AD start year
  endDate: Date;             // approx July 15 of AD end year
}

/**
 * Converts Western digits (0-9) to Nepali Unicode numerals (०-९)
 */
export function toNepaliDigits(input: string | number): string {
  const nepaliDigits = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
  return String(input).replace(/[0-9]/g, (digit) => nepaliDigits[Number(digit)]);
}

/**
 * Computes the Nepali Fiscal Year info for a given Date.
 */
export function getFiscalYearInfo(date: Date = new Date()): FiscalYearInfo {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  const adYear = d.getFullYear();
  const adMonth = d.getMonth() + 1; // 1-12
  const adDay = d.getDate();

  // In Nepal, Shrawan 1 typically falls around July 16/17.
  // Before July 16, the fiscal year belongs to the previous BS year.
  const isAfterShrawan1 = adMonth > 7 || (adMonth === 7 && adDay >= 16);
  const adStartYear = isAfterShrawan1 ? adYear : adYear - 1;
  const adEndYear = adStartYear + 1;

  const bsStartYear = adStartYear + 57;
  const bsEndYear = bsStartYear + 1;

  const bsStartShort = bsStartYear % 100;
  const bsEndShort = bsEndYear % 100;

  const shortCode = `${String(bsStartShort).padStart(2, "0")}/${String(bsEndShort).padStart(2, "0")}`;
  const labelEn = `FY ${bsStartYear}/${String(bsEndShort).padStart(2, "0")}`;
  
  const nepStartYear = toNepaliDigits(bsStartYear);
  const nepEndShort = toNepaliDigits(String(bsEndShort).padStart(2, "0"));
  const labelNp = `आ.व. ${nepStartYear}/${nepEndShort}`;
  const fullLabel = `${labelNp} (${labelEn})`;

  const startDate = new Date(adStartYear, 6, 16, 0, 0, 0, 0); // Month index 6 = July
  const endDate = new Date(adEndYear, 6, 15, 23, 59, 59, 999);

  return {
    bsStartYear,
    bsEndYear,
    shortCode,
    labelEn,
    labelNp,
    fullLabel,
    startDate,
    endDate
  };
}

/**
 * Given a month object { year: number, month: number }, returns the fiscal year for that month.
 */
export function getFiscalYearForMonth(year: number, month: number): FiscalYearInfo {
  // Use mid-month date to avoid day boundary issues
  const testDate = new Date(year, month, 15);
  return getFiscalYearInfo(testDate);
}

/**
 * Returns a list of recent fiscal years for dropdown selectors.
 * e.g. Current FY, Current - 1, Current - 2, Current - 3
 */
export function getRecentFiscalYears(count: number = 4): FiscalYearInfo[] {
  const current = getFiscalYearInfo(new Date());
  const list: FiscalYearInfo[] = [];

  for (let i = 0; i < count; i++) {
    // Offset by i years
    const sampleYear = current.startDate.getFullYear() - i;
    const sampleDate = new Date(sampleYear, 8, 1); // September of that FY
    list.push(getFiscalYearInfo(sampleDate));
  }

  return list;
}

/**
 * Checks if a given date string or Date falls within a specific Nepali Fiscal Year (by bsStartYear, e.g. 2081)
 */
export function isDateInFiscalYear(dateStrOrDate: string | Date | undefined | null, bsStartYear: number): boolean {
  if (!dateStrOrDate) return false;
  try {
    const d = typeof dateStrOrDate === "string" ? new Date(dateStrOrDate) : dateStrOrDate;
    if (isNaN(d.getTime())) return false;
    const fy = getFiscalYearInfo(d);
    return fy.bsStartYear === bsStartYear;
  } catch {
    return false;
  }
}
