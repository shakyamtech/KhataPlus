export const fmt = (n: number | string | null | undefined) => {
  let v = Number(n ?? 0);
  if (isNaN(v)) return "Rs. 0";
  v = Math.round(v * 100) / 100;
  const hasDecimals = v % 1 !== 0;
  return "Rs. " + v.toLocaleString("en-IN", { 
    minimumFractionDigits: hasDecimals ? 2 : 0, 
    maximumFractionDigits: 2 
  });
};

export const fmtQty = (n: number | string | null | undefined) => {
  let v = Number(n ?? 0);
  if (isNaN(v)) return "0";
  v = Math.round(v * 1000) / 1000;
  return v.toLocaleString("en-IN", { maximumFractionDigits: 3 });
};

export const numberToWords = (amount: number | string | null | undefined): string => {
  const num = Math.round(Number(amount || 0) * 100) / 100;
  if (isNaN(num) || num === 0) return "Zero Rupees Only";

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const convertLessThanOneThousand = (n: number): string => {
    let current = "";
    if (n >= 100) {
      current += ones[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n >= 20) {
      current += tens[Math.floor(n / 10)] + " ";
      n %= 10;
    }
    if (n > 0) {
      current += ones[n] + " ";
    }
    return current.trim();
  };

  const rupees = Math.floor(num);
  const paisa = Math.round((num - rupees) * 100);

  let result = "";
  let temp = rupees;

  const crore = Math.floor(temp / 10000000);
  temp %= 10000000;
  const lakh = Math.floor(temp / 100000);
  temp %= 100000;
  const thousand = Math.floor(temp / 1000);
  temp %= 1000;
  const remainder = temp;

  if (crore > 0) result += convertLessThanOneThousand(crore) + " Crore ";
  if (lakh > 0) result += convertLessThanOneThousand(lakh) + " Lakh ";
  if (thousand > 0) result += convertLessThanOneThousand(thousand) + " Thousand ";
  if (remainder > 0) result += convertLessThanOneThousand(remainder) + " ";

  result = result.trim() + " Rupees";
  if (paisa > 0) {
    result += " and " + convertLessThanOneThousand(paisa) + " Paisa";
  }
  result += " Only";

  return result;
};
