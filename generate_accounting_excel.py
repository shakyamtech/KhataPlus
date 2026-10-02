import os
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def build_accounting_workbook():
    wb = openpyxl.Workbook()
    # Remove default sheet
    wb.remove(wb.active)

    # Theme Colors
    NAVY_DARK = "1E3A8A"      # Primary Header
    SLATE_DARK = "334155"     # Section Header
    HEADER_TEXT = "FFFFFF"    # White Text
    BG_LIGHT_BLUE = "EFF6FF"  # Soft Blue highlight
    BG_LIGHT_GREEN = "ECFDF5" # Soft Green highlight
    BORDER_GRAY = "CBD5E1"    # Light Gray Border
    ROW_ALT = "F8FAFC"        # Alternating row

    font_title = Font(name="Calibri", size=14, bold=True, color=HEADER_TEXT)
    font_section = Font(name="Calibri", size=11, bold=True, color=HEADER_TEXT)
    font_col_header = Font(name="Calibri", size=10, bold=True, color=HEADER_TEXT)
    font_sub_header = Font(name="Calibri", size=10, bold=True, color=SLATE_DARK)
    font_data = Font(name="Calibri", size=10, bold=False, color="1E293B")
    font_data_bold = Font(name="Calibri", size=10, bold=True, color="1E293B")
    font_total = Font(name="Calibri", size=11, bold=True, color="0F172A")
    font_kpi_value = Font(name="Calibri", size=16, bold=True, color="1E3A8A")
    font_kpi_title = Font(name="Calibri", size=10, bold=True, color="64748B")

    fill_navy = PatternFill(start_color=NAVY_DARK, end_color=NAVY_DARK, fill_type="solid")
    fill_slate = PatternFill(start_color=SLATE_DARK, end_color=SLATE_DARK, fill_type="solid")
    fill_alt = PatternFill(start_color=ROW_ALT, end_color=ROW_ALT, fill_type="solid")
    fill_light_blue = PatternFill(start_color=BG_LIGHT_BLUE, end_color=BG_LIGHT_BLUE, fill_type="solid")
    fill_light_green = PatternFill(start_color=BG_LIGHT_GREEN, end_color=BG_LIGHT_GREEN, fill_type="solid")
    fill_total = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")

    thin_border_side = Side(style='thin', color=BORDER_GRAY)
    double_bottom_side = Side(style='double', color="0F172A")

    box_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)
    total_border = Border(top=thin_border_side, bottom=double_bottom_side, left=thin_border_side, right=thin_border_side)

    # -------------------------------------------------------------
    # 1. SHEET: Dashboard
    # -------------------------------------------------------------
    ws_dash = wb.create_sheet(title="Dashboard")
    ws_dash.views.sheetView[0].showGridLines = True

    # Title Banner
    ws_dash.merge_cells("A1:K2")
    ws_dash["A1"] = "📊 KHATAPLUS AUTOMATED ACCOUNTING SYSTEM (EXCEL EDITION)"
    ws_dash["A1"].font = font_title
    ws_dash["A1"].fill = fill_navy
    ws_dash["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws_dash.merge_cells("A3:K3")
    ws_dash["A3"] = "Nepal Accounting & Tax Standard • Automated Trial Balance • P&L • Balance Sheet • Journal Vouchers"
    ws_dash["A3"].font = Font(name="Calibri", size=10, italic=True, color="64748B")
    ws_dash["A3"].alignment = Alignment(horizontal="center", vertical="center")

    # KPI Cards Row
    kpis = [
        ("B5", "B6", "Total Sales (बिक्री)", "=Sales_Register!H50"),
        ("D5", "D6", "Total Purchases (खरिद)", "=Purchase_Register!H50"),
        ("F5", "F6", "Net Profit / (Loss)", "=Profit_and_Loss!D29"),
        ("H5", "H6", "Net VAT Payable / (Credit)", "=VAT_Summary!D16"),
        ("J5", "J6", "System Balance Status", '=IF(ROUND(Balance_Sheet!D24,2)=0,"✅ BALANCED","❌ MISMATCH")')
    ]

    for title_cell, val_cell, title_text, formula_val in kpis:
        c_title = ws_dash[title_cell]
        c_title.value = title_text
        c_title.font = font_kpi_title
        c_title.alignment = Alignment(horizontal="center", vertical="center")

        c_val = ws_dash[val_cell]
        c_val.value = formula_val
        c_val.font = font_kpi_value
        c_val.alignment = Alignment(horizontal="center", vertical="center")
        if "BALANCED" not in formula_val:
            c_val.number_format = '[$Rs. ]#,##0.00;([$Rs. ]#,##0.00);"-"'

    # Merge KPI pairs
    ws_dash.merge_cells("B5:C5")
    ws_dash.merge_cells("B6:C6")
    ws_dash.merge_cells("D5:E5")
    ws_dash.merge_cells("D6:E6")
    ws_dash.merge_cells("F5:G5")
    ws_dash.merge_cells("F6:G6")
    ws_dash.merge_cells("H5:I5")
    ws_dash.merge_cells("H6:I6")
    ws_dash.merge_cells("J5:K5")
    ws_dash.merge_cells("J6:K6")

    # KPI boxes styling
    for r in range(5, 8):
        for c in range(1, 12):
            cell = ws_dash.cell(row=r, column=c)
            cell.fill = fill_light_blue
            cell.border = box_border

    # Navigation & Quick Guide Table
    ws_dash.merge_cells("A9:K9")
    ws_dash["A9"] = "📋 SHEET NAVIGATION & USER WORKFLOW GUIDE"
    ws_dash["A9"].font = font_section
    ws_dash["A9"].fill = fill_slate
    ws_dash["A9"].alignment = Alignment(horizontal="left", vertical="center", indent=1)

    ws_dash.cell(row=10, column=1, value="S.N.")
    ws_dash.cell(row=10, column=2, value="Sheet Name (ट्याब)")
    ws_dash.cell(row=10, column=3, value="Type (प्रकार)")
    ws_dash.merge_cells("D10:F10")
    ws_dash.cell(row=10, column=4, value="Description (प्रयोजन)")
    ws_dash.merge_cells("G10:K10")
    ws_dash.cell(row=10, column=7, value="Automated Action (स्वचालित प्रणाली)")

    for c in range(1, 12):
        cell = ws_dash.cell(row=10, column=c)
        cell.fill = fill_navy
        cell.font = font_col_header
        cell.alignment = Alignment(horizontal="center", vertical="center")

    nav_rows = [
        ("1", "Chart_of_Accounts", "Setup", "सबै लेजर खाताहरूको सूची र आर्थिक वर्ष सुरुको Opening Balance राख्ने।", "Trial Balance र सबै रिपोर्टमा खाताहरू यहाँबाट लिन्छ।"),
        ("2", "Journal_Voucher", "Daily Entry", "डेबिट र क्रेडिट (JV) भौचर प्रविष्टि (Depreciation, Drawings, Adjustments, Loan आदि)।", "प्रत्येक भौचर अनुसार Total Debit = Total Credit परीक्षण गर्छ।"),
        ("3", "Sales_Register", "Daily Entry", "दैनिक बिक्री बिल (Cash, Bank वा Credit/आसामी) र १३% VAT को हिसाब।", "Sales Revenue, VAT Output, र Debtors/Bank खातामा सिधै जोडिन्छ।"),
        ("4", "Purchase_Register", "Daily Entry", "दैनिक खरिद बिल (सामान खरिद, कच्चा पदार्थ) र १३% VAT Input हिसाब।", "Purchase Expense, VAT Input, र Creditors/Bank खातामा सिधै जोडिन्छ।"),
        ("5", "Cash_Bank_Expenses", "Daily Entry", "दैनिक सञ्चालन खर्च (Rent, Salary, Electricity आदि) र नगद/बैंक भुक्तानी।", "P&L मा खर्च र Cash/Bank ब्यालेन्स स्वतः घटाउँछ।"),
        ("6", "Trial_Balance", "Auto Report", "सबै खाताको कुल डेबिट/क्रेडिट र अन्तिम मौज्दातको सन्तुलन परीक्षण।", "SUMIFS फर्मुलाले सबै इन्ट्रीहरूबाट स्वतः जोडेर Debit=Credit मिलाउँछ।"),
        ("7", "Profit_and_Loss", "Auto Report", "नाफा-नोक्सान खाता (Sales - COGS = Gross Profit - Expenses = Net Profit)।", "Trial Balance बाट स्वतः डाटा लिएर नाफा गणना गर्छ।"),
        ("8", "Balance_Sheet", "Auto Report", "वासलात (Assets vs Liabilities + Capital + Current Net Profit)।", "Assets = Liabilities + Equity सन्तुलन १००% स्वचालित परीक्षण गर्छ।"),
        ("9", "VAT_Summary", "Auto Report", "मासिक/आवधिक कर विवरण (Sales VAT Output - Purchase VAT Input = Net Tax)।", "IRD कर विवरण (Tax Return) भर्न आवश्यक हिसाब दिन्छ।")
    ]

    for idx, row_data in enumerate(nav_rows, start=11):
        ws_dash.cell(row=idx, column=1, value=row_data[0]).alignment = Alignment(horizontal="center")
        ws_dash.cell(row=idx, column=2, value=row_data[1]).alignment = Alignment(horizontal="left", indent=1)
        ws_dash.cell(row=idx, column=3, value=row_data[2]).alignment = Alignment(horizontal="center")
        
        ws_dash.merge_cells(start_row=idx, start_column=4, end_row=idx, end_column=6)
        ws_dash.cell(row=idx, column=4, value=row_data[3]).alignment = Alignment(horizontal="left", indent=1)
        
        ws_dash.merge_cells(start_row=idx, start_column=7, end_row=idx, end_column=11)
        ws_dash.cell(row=idx, column=7, value=row_data[4]).alignment = Alignment(horizontal="left", indent=1)

        fill_r = fill_alt if idx % 2 == 0 else PatternFill(fill_type=None)
        for c in range(1, 12):
            cell = ws_dash.cell(row=idx, column=c)
            cell.font = font_data
            cell.border = box_border
            if fill_r.fill_type:
                cell.fill = fill_r

    # -------------------------------------------------------------
    # 2. SHEET: Chart_of_Accounts
    # -------------------------------------------------------------
    ws_coa = wb.create_sheet(title="Chart_of_Accounts")
    ws_coa.views.sheetView[0].showGridLines = True

    ws_coa.merge_cells("A1:G2")
    ws_coa["A1"] = "📚 CHART OF ACCOUNTS & OPENING BALANCES (लेजर खाता सूची र सुरुको मौज्दात)"
    ws_coa["A1"].font = font_title
    ws_coa["A1"].fill = fill_navy
    ws_coa["A1"].alignment = Alignment(horizontal="center", vertical="center")

    coa_headers = ["Account Code", "Account Name (खाताको नाम)", "Main Group (मुख्य समूह)", "Sub-Category (उप-वर्ग)", "Dr/Cr Normal", "Opening Debit (Rs.)", "Opening Credit (Rs.)"]
    for col_idx, h in enumerate(coa_headers, start=1):
        c = ws_coa.cell(row=3, column=col_idx, value=h)
        c.font = font_col_header
        c.fill = fill_slate
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = box_border

    sample_coa = [
        ("1010", "Cash in Hand", "Current Assets", "Cash & Cash Equivalents", "Debit", 50000, 0),
        ("1020", "Nabil Bank Current A/C", "Current Assets", "Bank Balances", "Debit", 250000, 0),
        ("1030", "Global IME Bank A/C", "Current Assets", "Bank Balances", "Debit", 100000, 0),
        ("1040", "eSewa / Digital Wallet", "Current Assets", "Digital Wallets", "Debit", 25000, 0),
        ("1100", "Sundry Debtors (कुल ग्राहक आसामी)", "Current Assets", "Trade Receivables", "Debit", 65000, 0),
        ("1200", "Opening Inventory / Stock", "Direct Expenses", "Cost of Sales", "Debit", 120000, 0),
        ("1300", "VAT Input (खरिद भ्याट)", "Current Assets", "Duties & Taxes", "Debit", 0, 0),
        ("1510", "Furniture & Fixtures", "Fixed Assets", "Tangible Assets", "Debit", 80000, 0),
        ("1520", "Computer & Office Equipment", "Fixed Assets", "Tangible Assets", "Debit", 60000, 0),
        ("1530", "Accumulated Depreciation", "Fixed Assets", "Contra Asset", "Credit", 0, 14000),
        ("2010", "Sundry Creditors (कुल साहु)", "Current Liabilities", "Trade Payables", "Credit", 0, 95000),
        ("2020", "VAT Output (बिक्री भ्याट)", "Current Liabilities", "Duties & Taxes", "Credit", 0, 0),
        ("2030", "Salary Payable (तिर्न बाँकी तलब)", "Current Liabilities", "Outstanding Expenses", "Credit", 0, 20000),
        ("2100", "Bank Loan (Nabil Overdraft)", "Long Term Liabilities", "Secured Loans", "Credit", 0, 150000),
        ("3010", "Owner Capital (मालिकको पुँजी)", "Equity", "Capital Account", "Credit", 0, 471000),
        ("3020", "Owner Drawings (मालिकको निकासी)", "Equity", "Contra Equity", "Debit", 0, 0),
        ("4010", "Sales Revenue (बिक्री आम्दानी)", "Direct Income", "Revenue", "Credit", 0, 0),
        ("4020", "Discount Received (प्राप्त छुट)", "Indirect Income", "Other Income", "Credit", 0, 0),
        ("5010", "Purchases (सामान खरिद)", "Direct Expenses", "Cost of Sales", "Debit", 0, 0),
        ("5020", "Direct Freight & Carriage", "Direct Expenses", "Direct Expenses", "Debit", 0, 0),
        ("6010", "Shop & Office Rent", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0),
        ("6020", "Staff Salaries & Wages", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0),
        ("6030", "Electricity & Water", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0),
        ("6040", "Tea, Snacks & Refreshment", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0),
        ("6050", "Internet & Communication", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0),
        ("6060", "Stationery & Printing", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0),
        ("6070", "Marketing & Promotion", "Indirect Expenses", "Operating Expenses", "Debit", 0, 0),
        ("6080", "Depreciation Expense", "Indirect Expenses", "Depreciation & Amortization", "Debit", 0, 0),
        ("6090", "Bank Charges & Interest", "Indirect Expenses", "Financial Expenses", "Debit", 0, 0)
    ]

    for idx, row in enumerate(sample_coa, start=4):
        ws_coa.cell(row=idx, column=1, value=row[0]).alignment = Alignment(horizontal="center")
        ws_coa.cell(row=idx, column=2, value=row[1]).alignment = Alignment(horizontal="left")
        ws_coa.cell(row=idx, column=3, value=row[2]).alignment = Alignment(horizontal="left")
        ws_coa.cell(row=idx, column=4, value=row[3]).alignment = Alignment(horizontal="left")
        ws_coa.cell(row=idx, column=5, value=row[4]).alignment = Alignment(horizontal="center")
        
        c_dr = ws_coa.cell(row=idx, column=6, value=row[5])
        c_dr.alignment = Alignment(horizontal="right")
        c_dr.number_format = '#,##0.00;(#,##0.00);"-"'

        c_cr = ws_coa.cell(row=idx, column=7, value=row[6])
        c_cr.alignment = Alignment(horizontal="right")
        c_cr.number_format = '#,##0.00;(#,##0.00);"-"'

        for c in range(1, 8):
            cell = ws_coa.cell(row=idx, column=c)
            cell.font = font_data
            cell.border = box_border

    tot_row = len(sample_coa) + 4
    ws_coa.merge_cells(f"A{tot_row}:E{tot_row}")
    ws_coa[f"A{tot_row}"] = "TOTAL OPENING BALANCE (कुल सुरुको मौज्दात):"
    ws_coa[f"A{tot_row}"].font = font_total
    ws_coa[f"A{tot_row}"].alignment = Alignment(horizontal="right", vertical="center")
    
    ws_coa[f"F{tot_row}"] = f"=SUM(F4:F{tot_row-1})"
    ws_coa[f"F{tot_row}"].font = font_total
    ws_coa[f"F{tot_row}"].number_format = '#,##0.00'
    ws_coa[f"F{tot_row}"].alignment = Alignment(horizontal="right")

    ws_coa[f"G{tot_row}"] = f"=SUM(G4:G{tot_row-1})"
    ws_coa[f"G{tot_row}"].font = font_total
    ws_coa[f"G{tot_row}"].number_format = '#,##0.00'
    ws_coa[f"G{tot_row}"].alignment = Alignment(horizontal="right")

    for c in range(1, 8):
        cell = ws_coa.cell(row=tot_row, column=c)
        cell.fill = fill_total
        cell.border = total_border

    # -------------------------------------------------------------
    # 3. SHEET: Journal_Voucher
    # -------------------------------------------------------------
    ws_jv = wb.create_sheet(title="Journal_Voucher")
    ws_jv.views.sheetView[0].showGridLines = True

    ws_jv.merge_cells("A1:H2")
    ws_jv["A1"] = "📝 JOURNAL VOUCHER (JV) REGISTER (दोहोरो लेखा भौचर प्रविष्टि)"
    ws_jv["A1"].font = font_title
    ws_jv["A1"].fill = fill_navy
    ws_jv["A1"].alignment = Alignment(horizontal="center", vertical="center")

    jv_headers = ["Date (मिति)", "JV No.", "Debit Account (डेबिट खाता)", "Credit Account (क्रेडिट खाता)", "Debit Amount (Rs.)", "Credit Amount (Rs.)", "Narration / Particulars (विवरण)", "Reference / Bill No"]
    for col_idx, h in enumerate(jv_headers, start=1):
        c = ws_jv.cell(row=3, column=col_idx, value=h)
        c.font = font_col_header
        c.fill = fill_slate
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = box_border

    sample_jv = [
        ("2081-04-05", "JV-001", "Computer & Office Equipment", "Global IME Bank A/C", 35000, 0, "Office computer purchase paid via Global IME Bank", "Cheque #8812"),
        ("2081-04-05", "JV-001", "", "", 0, 35000, "", ""),
        ("2081-04-12", "JV-002", "Owner Drawings (मालिकको निकासी)", "Cash in Hand", 8000, 0, "Cash withdrawn by proprietor for personal household expense", "Self Voucher"),
        ("2081-04-12", "JV-002", "", "", 0, 8000, "", ""),
        ("2081-04-25", "JV-003", "Salary Payable (तिर्न बाँकी तलब)", "Nabil Bank Current A/C", 20000, 0, "Previous month unpaid salary cleared via Bank transfer", "Bank Trf #910"),
        ("2081-04-25", "JV-003", "", "", 0, 20000, "", ""),
        ("2081-04-30", "JV-004", "Depreciation Expense", "Accumulated Depreciation", 2500, 0, "Monthly depreciation on Computers and Furniture", "Depr Schedule"),
        ("2081-04-30", "JV-004", "", "", 0, 2500, "", "")
    ]

    for idx, row in enumerate(sample_jv, start=4):
        ws_jv.cell(row=idx, column=1, value=row[0]).alignment = Alignment(horizontal="center")
        ws_jv.cell(row=idx, column=2, value=row[1]).alignment = Alignment(horizontal="center")
        ws_jv.cell(row=idx, column=3, value=row[2]).alignment = Alignment(horizontal="left")
        ws_jv.cell(row=idx, column=4, value=row[3]).alignment = Alignment(horizontal="left")
        
        c_dr = ws_jv.cell(row=idx, column=5, value=row[4])
        c_dr.alignment = Alignment(horizontal="right")
        c_dr.number_format = '#,##0.00;(#,##0.00);"-"'

        c_cr = ws_jv.cell(row=idx, column=6, value=row[5])
        c_cr.alignment = Alignment(horizontal="right")
        c_cr.number_format = '#,##0.00;(#,##0.00);"-"'

        ws_jv.cell(row=idx, column=7, value=row[6]).alignment = Alignment(horizontal="left")
        ws_jv.cell(row=idx, column=8, value=row[7]).alignment = Alignment(horizontal="center")

        for c in range(1, 9):
            cell = ws_jv.cell(row=idx, column=c)
            cell.font = font_data
            cell.border = box_border

    # Blank rows
    for idx in range(12, 50):
        for c in range(1, 9):
            cell = ws_jv.cell(row=idx, column=c)
            cell.font = font_data
            cell.border = box_border
            if c in [5, 6]:
                cell.number_format = '#,##0.00;(#,##0.00);"-"'

    tot_jv_row = 50
    ws_jv.merge_cells(f"A{tot_jv_row}:D{tot_jv_row}")
    ws_jv[f"A{tot_jv_row}"] = "TOTAL JOURNAL VOUCHERS (कुल भौचर योग):"
    ws_jv[f"A{tot_jv_row}"].font = font_total
    ws_jv[f"A{tot_jv_row}"].alignment = Alignment(horizontal="right", vertical="center")

    ws_jv[f"E{tot_jv_row}"] = f"=SUM(E4:E{tot_jv_row-1})"
    ws_jv[f"E{tot_jv_row}"].font = font_total
    ws_jv[f"E{tot_jv_row}"].number_format = '#,##0.00'
    ws_jv[f"E{tot_jv_row}"].alignment = Alignment(horizontal="right")

    ws_jv[f"F{tot_jv_row}"] = f"=SUM(F4:F{tot_jv_row-1})"
    ws_jv[f"F{tot_jv_row}"].font = font_total
    ws_jv[f"F{tot_jv_row}"].number_format = '#,##0.00'
    ws_jv[f"F{tot_jv_row}"].alignment = Alignment(horizontal="right")

    ws_jv[f"G{tot_jv_row}"] = f'=IF(ROUND(E{tot_jv_row}-F{tot_jv_row},2)=0,"✅ JV BALANCED (डेबिट=क्रेडिट मिल्यो)","❌ JV MISMATCH (फरक छ!)")'
    ws_jv[f"G{tot_jv_row}"].font = font_data_bold
    ws_jv[f"G{tot_jv_row}"].alignment = Alignment(horizontal="center", vertical="center")

    for c in range(1, 9):
        cell = ws_jv.cell(row=tot_jv_row, column=c)
        cell.fill = fill_total
        cell.border = total_border

    # -------------------------------------------------------------
    # 4. SHEET: Sales_Register
    # -------------------------------------------------------------
    ws_sales = wb.create_sheet(title="Sales_Register")
    ws_sales.views.sheetView[0].showGridLines = True

    ws_sales.merge_cells("A1:J2")
    ws_sales["A1"] = "💰 SALES REGISTER (बिक्री खाता - IRD ढाँचा अनुसार)"
    ws_sales["A1"].font = font_title
    ws_sales["A1"].fill = fill_navy
    ws_sales["A1"].alignment = Alignment(horizontal="center", vertical="center")

    sales_headers = ["Date (मिति)", "Invoice No (बिल नं)", "Buyer Name (ग्राहकको नाम)", "Buyer PAN", "Taxable Sales (करयोग्य)", "Non-Taxable (कर छुट)", "13% VAT Output", "Total Invoice (कुल बिल)", "Payment Mode", "Bank / Account"]
    for col_idx, h in enumerate(sales_headers, start=1):
        c = ws_sales.cell(row=3, column=col_idx, value=h)
        c.font = font_col_header
        c.fill = fill_slate
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = box_border

    sample_sales = [
        ("2081-04-02", "INV-101", "Himalayan Traders", "601928374", 45000, 0, "=E4*0.13", "=E4+F4+G4", "Bank", "Nabil Bank Current A/C"),
        ("2081-04-07", "INV-102", "Ram Krishna Shrestha (Cash)", "", 12000, 0, "=E5*0.13", "=E5+F5+G5", "Cash", "Cash in Hand"),
        ("2081-04-14", "INV-103", "Apex Stationery Store", "302847581", 60000, 0, "=E6*0.13", "=E6+F6+G6", "Credit", "Sundry Debtors (कुल ग्राहक आसामी)"),
        ("2081-04-22", "INV-104", "Everest Tech Care", "602738491", 35000, 0, "=E7*0.13", "=E7+F7+G7", "Bank", "Global IME Bank A/C"),
        ("2081-04-28", "INV-105", "Sita Devi Retail Counter", "", 18000, 0, "=E8*0.13", "=E8+F8+G8", "eSewa", "eSewa / Digital Wallet")
    ]

    for idx, row in enumerate(sample_sales, start=4):
        ws_sales.cell(row=idx, column=1, value=row[0]).alignment = Alignment(horizontal="center")
        ws_sales.cell(row=idx, column=2, value=row[1]).alignment = Alignment(horizontal="center")
        ws_sales.cell(row=idx, column=3, value=row[2]).alignment = Alignment(horizontal="left")
        ws_sales.cell(row=idx, column=4, value=row[3]).alignment = Alignment(horizontal="center")

        c_tax = ws_sales.cell(row=idx, column=5, value=row[4])
        c_tax.number_format = '#,##0.00;(#,##0.00);"-"'
        c_tax.alignment = Alignment(horizontal="right")

        c_nontax = ws_sales.cell(row=idx, column=6, value=row[5])
        c_nontax.number_format = '#,##0.00;(#,##0.00);"-"'
        c_nontax.alignment = Alignment(horizontal="right")

        c_vat = ws_sales.cell(row=idx, column=7, value=row[6])
        c_vat.number_format = '#,##0.00;(#,##0.00);"-"'
        c_vat.alignment = Alignment(horizontal="right")

        c_tot = ws_sales.cell(row=idx, column=8, value=row[7])
        c_tot.number_format = '#,##0.00;(#,##0.00);"-"'
        c_tot.alignment = Alignment(horizontal="right")

        ws_sales.cell(row=idx, column=9, value=row[8]).alignment = Alignment(horizontal="center")
        ws_sales.cell(row=idx, column=10, value=row[9]).alignment = Alignment(horizontal="left")

        for c in range(1, 11):
            cell = ws_sales.cell(row=idx, column=c)
            cell.font = font_data
            cell.border = box_border

    # Blank rows for sales
    for idx in range(9, 50):
        ws_sales.cell(row=idx, column=7, value=f"=IF(E{idx}>0, E{idx}*0.13, 0)")
        ws_sales.cell(row=idx, column=8, value=f"=IF(E{idx}+F{idx}>0, E{idx}+F{idx}+G{idx}, 0)")
        for c in range(1, 11):
            cell = ws_sales.cell(row=idx, column=c)
            cell.font = font_data
            cell.border = box_border
            if c in [5, 6, 7, 8]:
                cell.number_format = '#,##0.00;(#,##0.00);"-"'

    tot_sales_row = 50
    ws_sales.merge_cells(f"A{tot_sales_row}:D{tot_sales_row}")
    ws_sales[f"A{tot_sales_row}"] = "TOTAL SALES (कुल बिक्री योग):"
    ws_sales[f"A{tot_sales_row}"].font = font_total
    ws_sales[f"A{tot_sales_row}"].alignment = Alignment(horizontal="right", vertical="center")

    for col_letter in ["E", "F", "G", "H"]:
        ws_sales[f"{col_letter}{tot_sales_row}"] = f"=SUM({col_letter}4:{col_letter}{tot_sales_row-1})"
        ws_sales[f"{col_letter}{tot_sales_row}"].font = font_total
        ws_sales[f"{col_letter}{tot_sales_row}"].number_format = '#,##0.00'
        ws_sales[f"{col_letter}{tot_sales_row}"].alignment = Alignment(horizontal="right")

    for c in range(1, 11):
        cell = ws_sales.cell(row=tot_sales_row, column=c)
        cell.fill = fill_total
        cell.border = total_border

    # -------------------------------------------------------------
    # 5. SHEET: Purchase_Register
    # -------------------------------------------------------------
    ws_pur = wb.create_sheet(title="Purchase_Register")
    ws_pur.views.sheetView[0].showGridLines = True

    ws_pur.merge_cells("A1:J2")
    ws_pur["A1"] = "📦 PURCHASE REGISTER (खरिद खाता - IRD ढाँचा अनुसार)"
    ws_pur["A1"].font = font_title
    ws_pur["A1"].fill = fill_navy
    ws_pur["A1"].alignment = Alignment(horizontal="center", vertical="center")

    pur_headers = ["Date (मिति)", "Supplier Bill No", "Supplier Name (सप्लायरको नाम)", "Supplier PAN", "Taxable Purchase (करयोग्य)", "Non-Taxable (कर छुट)", "13% VAT Input", "Total Bill (कुल खरिद)", "Payment Mode", "Bank / Account"]
    for col_idx, h in enumerate(pur_headers, start=1):
        c = ws_pur.cell(row=3, column=col_idx, value=h)
        c.font = font_col_header
        c.fill = fill_slate
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = box_border

    sample_pur = [
        ("2081-04-03", "SB-5501", "National Distributors Pvt Ltd", "500192837", 80000, 0, "=E4*0.13", "=E4+F4+G4", "Bank", "Nabil Bank Current A/C"),
        ("2081-04-10", "SB-2291", "Pashupati Paper Mills", "301928475", 30000, 0, "=E5*0.13", "=E5+F5+G5", "Credit", "Sundry Creditors (कुल साहु)"),
        ("2081-04-18", "SB-9011", "Global Import & Export", "602819374", 55000, 0, "=E6*0.13", "=E6+F6+G6", "Bank", "Global IME Bank A/C"),
        ("2081-04-26", "SB-1002", "Local Wholesale Market", "", 15000, 0, "=E7*0.13", "=E7+F7+G7", "Cash", "Cash in Hand")
    ]

    for idx, row in enumerate(sample_pur, start=4):
        ws_pur.cell(row=idx, column=1, value=row[0]).alignment = Alignment(horizontal="center")
        ws_pur.cell(row=idx, column=2, value=row[1]).alignment = Alignment(horizontal="center")
        ws_pur.cell(row=idx, column=3, value=row[2]).alignment = Alignment(horizontal="left")
        ws_pur.cell(row=idx, column=4, value=row[3]).alignment = Alignment(horizontal="center")

        c_tax = ws_pur.cell(row=idx, column=5, value=row[4])
        c_tax.number_format = '#,##0.00;(#,##0.00);"-"'
        c_tax.alignment = Alignment(horizontal="right")

        c_nontax = ws_pur.cell(row=idx, column=6, value=row[5])
        c_nontax.number_format = '#,##0.00;(#,##0.00);"-"'
        c_nontax.alignment = Alignment(horizontal="right")

        c_vat = ws_pur.cell(row=idx, column=7, value=row[6])
        c_vat.number_format = '#,##0.00;(#,##0.00);"-"'
        c_vat.alignment = Alignment(horizontal="right")

        c_tot = ws_pur.cell(row=idx, column=8, value=row[7])
        c_tot.number_format = '#,##0.00;(#,##0.00);"-"'
        c_tot.alignment = Alignment(horizontal="right")

        ws_pur.cell(row=idx, column=9, value=row[8]).alignment = Alignment(horizontal="center")
        ws_pur.cell(row=idx, column=10, value=row[9]).alignment = Alignment(horizontal="left")

        for c in range(1, 11):
            cell = ws_pur.cell(row=idx, column=c)
            cell.font = font_data
            cell.border = box_border

    # Blank rows for pur
    for idx in range(8, 50):
        ws_pur.cell(row=idx, column=7, value=f"=IF(E{idx}>0, E{idx}*0.13, 0)")
        ws_pur.cell(row=idx, column=8, value=f"=IF(E{idx}+F{idx}>0, E{idx}+F{idx}+G{idx}, 0)")
        for c in range(1, 11):
            cell = ws_pur.cell(row=idx, column=c)
            cell.font = font_data
            cell.border = box_border
            if c in [5, 6, 7, 8]:
                cell.number_format = '#,##0.00;(#,##0.00);"-"'

    tot_pur_row = 50
    ws_pur.merge_cells(f"A{tot_pur_row}:D{tot_pur_row}")
    ws_pur[f"A{tot_pur_row}"] = "TOTAL PURCHASES (कुल खरिद योग):"
    ws_pur[f"A{tot_pur_row}"].font = font_total
    ws_pur[f"A{tot_pur_row}"].alignment = Alignment(horizontal="right", vertical="center")

    for col_letter in ["E", "F", "G", "H"]:
        ws_pur[f"{col_letter}{tot_pur_row}"] = f"=SUM({col_letter}4:{col_letter}{tot_pur_row-1})"
        ws_pur[f"{col_letter}{tot_pur_row}"].font = font_total
        ws_pur[f"{col_letter}{tot_pur_row}"].number_format = '#,##0.00'
        ws_pur[f"{col_letter}{tot_pur_row}"].alignment = Alignment(horizontal="right")

    for c in range(1, 11):
        cell = ws_pur.cell(row=tot_pur_row, column=c)
        cell.fill = fill_total
        cell.border = total_border

    # -------------------------------------------------------------
    # 6. SHEET: Cash_Bank_Expenses
    # -------------------------------------------------------------
    ws_exp = wb.create_sheet(title="Cash_Bank_Expenses")
    ws_exp.views.sheetView[0].showGridLines = True

    ws_exp.merge_cells("A1:H2")
    ws_exp["A1"] = "💸 DIRECT & OPERATING EXPENSES (दैनिक सञ्चालन खर्च तथा भुक्तानी)"
    ws_exp["A1"].font = font_title
    ws_exp["A1"].fill = fill_navy
    ws_exp["A1"].alignment = Alignment(horizontal="center", vertical="center")

    exp_headers = ["Date (मिति)", "Voucher No", "Expense Head (खर्च शीर्षक / खाता)", "Paid To (कसलाई भुक्तानी)", "Amount (रकम Rs.)", "Paid From (कुन खाताबाट)", "Payment Mode", "Remarks / Description"]
    for col_idx, h in enumerate(exp_headers, start=1):
        c = ws_exp.cell(row=3, column=col_idx, value=h)
        c.font = font_col_header
        c.fill = fill_slate
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = box_border

    sample_exp = [
        ("2081-04-01", "EXP-01", "Shop & Office Rent", "House Owner (Shyam Bahadur)", 25000, "Nabil Bank Current A/C", "Bank", "Monthly Shop Rent for Shrawan"),
        ("2081-04-06", "EXP-02", "Direct Freight & Carriage", "Local Transport Carrier", 3500, "Cash in Hand", "Cash", "Cartage on incoming purchase stock"),
        ("2081-04-15", "EXP-03", "Electricity & Water", "NEA Counter", 4200, "eSewa / Digital Wallet", "eSewa", "Electricity bill payment"),
        ("2081-04-20", "EXP-04", "Tea, Snacks & Refreshment", "Counter Boy", 2800, "Cash in Hand", "Cash", "Office tea, coffee and customer snacks"),
        ("2081-04-25", "EXP-05", "Internet & Communication", "WorldLink Communications", 1800, "Global IME Bank A/C", "Bank", "Monthly broadband internet bill"),
        ("2081-04-27", "EXP-06", "Stationery & Printing", "Sagarmatha Stationers", 3200, "Cash in Hand", "Cash", "Bill books, register, pen and A4 paper"),
        ("2081-04-29", "EXP-07", "Staff Salaries & Wages", "Staff Members (3 persons)", 35000, "Nabil Bank Current A/C", "Bank", "Staff salaries for the month of Shrawan")
    ]

    for idx, row in enumerate(sample_exp, start=4):
        ws_exp.cell(row=idx, column=1, value=row[0]).alignment = Alignment(horizontal="center")
        ws_exp.cell(row=idx, column=2, value=row[1]).alignment = Alignment(horizontal="center")
        ws_exp.cell(row=idx, column=3, value=row[2]).alignment = Alignment(horizontal="left")
        ws_exp.cell(row=idx, column=4, value=row[3]).alignment = Alignment(horizontal="left")

        c_amt = ws_exp.cell(row=idx, column=5, value=row[4])
        c_amt.number_format = '#,##0.00;(#,##0.00);"-"'
        c_amt.alignment = Alignment(horizontal="right")

        ws_exp.cell(row=idx, column=6, value=row[5]).alignment = Alignment(horizontal="left")
        ws_exp.cell(row=idx, column=7, value=row[6]).alignment = Alignment(horizontal="center")
        ws_exp.cell(row=idx, column=8, value=row[7]).alignment = Alignment(horizontal="left")

        for c in range(1, 9):
            cell = ws_exp.cell(row=idx, column=c)
            cell.font = font_data
            cell.border = box_border

    # Blank rows
    for idx in range(11, 50):
        for c in range(1, 9):
            cell = ws_exp.cell(row=idx, column=c)
            cell.font = font_data
            cell.border = box_border
            if c == 5:
                cell.number_format = '#,##0.00;(#,##0.00);"-"'

    tot_exp_row = 50
    ws_exp.merge_cells(f"A{tot_exp_row}:D{tot_exp_row}")
    ws_exp[f"A{tot_exp_row}"] = "TOTAL EXPENSES (कुल खर्च योग):"
    ws_exp[f"A{tot_exp_row}"].font = font_total
    ws_exp[f"A{tot_exp_row}"].alignment = Alignment(horizontal="right", vertical="center")

    ws_exp[f"E{tot_exp_row}"] = f"=SUM(E4:E{tot_exp_row-1})"
    ws_exp[f"E{tot_exp_row}"].font = font_total
    ws_exp[f"E{tot_exp_row}"].number_format = '#,##0.00'
    ws_exp[f"E{tot_exp_row}"].alignment = Alignment(horizontal="right")

    for c in range(1, 9):
        cell = ws_exp.cell(row=tot_exp_row, column=c)
        cell.fill = fill_total
        cell.border = total_border

    # -------------------------------------------------------------
    # 7. SHEET: Trial_Balance
    # -------------------------------------------------------------
    ws_tb = wb.create_sheet(title="Trial_Balance")
    ws_tb.views.sheetView[0].showGridLines = True

    ws_tb.merge_cells("A1:H2")
    ws_tb["A1"] = "⚖️ TRIAL BALANCE (सन्तुलन परीक्षण - स्वचालित दोहोरो लेखा)"
    ws_tb["A1"].font = font_title
    ws_tb["A1"].fill = fill_navy
    ws_tb["A1"].alignment = Alignment(horizontal="center", vertical="center")

    tb_headers = ["Account Code", "Account Name (खाताको नाम)", "Account Group", "Opening Dr", "Opening Cr", "Total Debit (Dr)", "Total Credit (Cr)", "Closing Net Balance (Rs.)"]
    for col_idx, h in enumerate(tb_headers, start=1):
        c = ws_tb.cell(row=3, column=col_idx, value=h)
        c.font = font_col_header
        c.fill = fill_slate
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = box_border

    for idx, row in enumerate(sample_coa, start=4):
        coa_row = idx
        ws_tb.cell(row=idx, column=1, value=f"=Chart_of_Accounts!A{coa_row}").alignment = Alignment(horizontal="center")
        ws_tb.cell(row=idx, column=2, value=f"=Chart_of_Accounts!B{coa_row}").alignment = Alignment(horizontal="left")
        ws_tb.cell(row=idx, column=3, value=f"=Chart_of_Accounts!C{coa_row}").alignment = Alignment(horizontal="left")
        ws_tb.cell(row=idx, column=4, value=f"=Chart_of_Accounts!F{coa_row}").alignment = Alignment(horizontal="right")
        ws_tb.cell(row=idx, column=5, value=f"=Chart_of_Accounts!G{coa_row}").alignment = Alignment(horizontal="right")

        # Debit calculation
        dr_formula = (
            f"=D{idx} + SUMIFS(Journal_Voucher!$E$4:$E$49, Journal_Voucher!$C$4:$C$49, B{idx}) "
            f"+ IF(B{idx}=\"Purchases (सामान खरिद)\", Purchase_Register!$E$50 + Purchase_Register!$F$50, 0) "
            f"+ IF(B{idx}=\"VAT Input (खरिद भ्याट)\", Purchase_Register!$G$50, 0) "
            f"+ SUMIFS(Sales_Register!$H$4:$H$49, Sales_Register!$J$4:$J$49, B{idx}) "
            f"+ SUMIFS(Cash_Bank_Expenses!$E$4:$E$49, Cash_Bank_Expenses!$C$4:$C$49, B{idx})"
        )
        c_dr = ws_tb.cell(row=idx, column=6, value=dr_formula)
        c_dr.alignment = Alignment(horizontal="right")
        c_dr.number_format = '#,##0.00;(#,##0.00);"-"'

        # Credit calculation
        cr_formula = (
            f"=E{idx} + SUMIFS(Journal_Voucher!$F$4:$F$49, Journal_Voucher!$D$4:$D$49, B{idx}) "
            f"+ IF(B{idx}=\"Sales Revenue (बिक्री आम्दानी)\", Sales_Register!$E$50 + Sales_Register!$F$50, 0) "
            f"+ IF(B{idx}=\"VAT Output (बिक्री भ्याट)\", Sales_Register!$G$50, 0) "
            f"+ SUMIFS(Purchase_Register!$H$4:$H$49, Purchase_Register!$J$4:$J$49, B{idx}) "
            f"+ SUMIFS(Cash_Bank_Expenses!$E$4:$E$49, Cash_Bank_Expenses!$F$4:$F$49, B{idx})"
        )
        c_cr = ws_tb.cell(row=idx, column=7, value=cr_formula)
        c_cr.alignment = Alignment(horizontal="right")
        c_cr.number_format = '#,##0.00;(#,##0.00);"-"'

        # Net Closing balance (Dr - Cr)
        net_formula = f"=F{idx}-G{idx}"
        c_net = ws_tb.cell(row=idx, column=8, value=net_formula)
        c_net.alignment = Alignment(horizontal="right")
        c_net.number_format = '[$Dr. ]#,##0.00;[$Cr. ]#,##0.00;"-"'

        for c in range(1, 9):
            cell = ws_tb.cell(row=idx, column=c)
            cell.font = font_data
            cell.border = box_border
            if c in [4, 5]:
                cell.number_format = '#,##0.00;(#,##0.00);"-"'

    tb_tot_row = len(sample_coa) + 4
    ws_tb.merge_cells(f"A{tb_tot_row}:E{tb_tot_row}")
    ws_tb[f"A{tb_tot_row}"] = "TOTAL TRIAL BALANCE (सन्तुलन परीक्षण योग):"
    ws_tb[f"A{tb_tot_row}"].font = font_total
    ws_tb[f"A{tb_tot_row}"].alignment = Alignment(horizontal="right", vertical="center")

    ws_tb[f"F{tb_tot_row}"] = f"=SUM(F4:F{tb_tot_row-1})"
    ws_tb[f"F{tb_tot_row}"].font = font_total
    ws_tb[f"F{tb_tot_row}"].number_format = '#,##0.00'
    ws_tb[f"F{tb_tot_row}"].alignment = Alignment(horizontal="right")

    ws_tb[f"G{tb_tot_row}"] = f"=SUM(G4:G{tb_tot_row-1})"
    ws_tb[f"G{tb_tot_row}"].font = font_total
    ws_tb[f"G{tb_tot_row}"].number_format = '#,##0.00'
    ws_tb[f"G{tb_tot_row}"].alignment = Alignment(horizontal="right")

    ws_tb[f"H{tb_tot_row}"] = f'=IF(ROUND(F{tb_tot_row}-G{tb_tot_row},2)=0,"✅ BALANCED (सन्तुलित)","❌ MISMATCH (फरक छ!)")'
    ws_tb[f"H{tb_tot_row}"].font = font_data_bold
    ws_tb[f"H{tb_tot_row}"].alignment = Alignment(horizontal="center", vertical="center")

    for c in range(1, 9):
        cell = ws_tb.cell(row=tb_tot_row, column=c)
        cell.fill = fill_total
        cell.border = total_border

    # -------------------------------------------------------------
    # 8. SHEET: Profit_and_Loss
    # -------------------------------------------------------------
    ws_pl = wb.create_sheet(title="Profit_and_Loss")
    ws_pl.views.sheetView[0].showGridLines = True

    ws_pl.merge_cells("A1:D2")
    ws_pl["A1"] = "📈 PROFIT & LOSS STATEMENT (नाफा-नोक्सान हिसाब खाता)"
    ws_pl["A1"].font = font_title
    ws_pl["A1"].fill = fill_navy
    ws_pl["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws_pl.merge_cells("A3:D3")
    ws_pl["A3"] = "For the Period Ended (चालु अवधिको वित्तीय विवरण)"
    ws_pl["A3"].font = Font(name="Calibri", size=10, italic=True, color="64748B")
    ws_pl["A3"].alignment = Alignment(horizontal="center")

    ws_pl.merge_cells("A5:B5")
    ws_pl["A5"] = "PARTICULARS (विवरण)"
    ws_pl["A5"].font = font_col_header
    ws_pl["A5"].fill = fill_slate
    ws_pl["A5"].alignment = Alignment(horizontal="left", indent=1)

    ws_pl["C5"] = "Ref / Schedule"
    ws_pl["C5"].font = font_col_header
    ws_pl["C5"].fill = fill_slate
    ws_pl["C5"].alignment = Alignment(horizontal="center")

    ws_pl["D5"] = "Amount (Rs.)"
    ws_pl["D5"].font = font_col_header
    ws_pl["D5"].fill = fill_slate
    ws_pl["D5"].alignment = Alignment(horizontal="right")

    for c in range(1, 5):
        ws_pl.cell(row=5, column=c).border = box_border

    pl_items = [
        # (Row, Particular, Ref, Formula/Value, IsHeader, IsTotal, IsSection)
        (6, "A. REVENUE FROM OPERATIONS (सञ्चालन आम्दानी)", "", "", False, False, True),
        (7, "   Gross Sales Revenue (कुल बिक्री)", "Sales Register", "=Sales_Register!E50+Sales_Register!F50", False, False, False),
        (8, "TOTAL REVENUE (कुल आम्दानी) [A]", "", "=D7", False, True, False),
        (9, "", "", "", False, False, False),
        (10, "B. COST OF GOODS SOLD / COGS (बिक्री भएको सामानको लागत)", "", "", False, False, True),
        (11, "   Opening Stock (सुरुको मौज्दात)", "COA 1200", "=Trial_Balance!F9", False, False, False),
        (12, "   Add: Purchases (कुल खरिद)", "Pur Register", "=Purchase_Register!E50+Purchase_Register!F50", False, False, False),
        (13, "   Add: Direct Freight & Carriage (ढुवानी खर्च)", "Cash/Bank Exp", "=Trial_Balance!F23", False, False, False),
        (14, "   Less: Closing Stock in Hand (अन्तिम मौज्दात)", "Physical Audit", 115000, False, False, False),
        (15, "TOTAL COST OF SALES (खरिद तथा प्रत्यक्ष लागत) [B]", "", "=D11+D12+D13-D14", False, True, False),
        (16, "", "", "", False, False, False),
        (17, "GROSS PROFIT / (LOSS) (कुल नाफा) [A - B]", "", "=D8-D15", True, True, False),
        (18, "", "", "", False, False, False),
        (19, "C. OPERATING & ADMINISTRATIVE EXPENSES (सञ्चालन तथा प्रशासनिक खर्च)", "", "", False, False, True),
        (20, "   Shop & Office Rent (भाडा खर्च)", "Cash/Bank Exp", "=Trial_Balance!F24", False, False, False),
        (21, "   Staff Salaries & Wages (तलब खर्च)", "Cash/Bank Exp", "=Trial_Balance!F25", False, False, False),
        (22, "   Electricity & Water (बिजुली तथा पानी)", "Cash/Bank Exp", "=Trial_Balance!F26", False, False, False),
        (23, "   Tea, Snacks & Refreshment (चिया तथा खाजा)", "Cash/Bank Exp", "=Trial_Balance!F27", False, False, False),
        (24, "   Internet & Communication (इन्टरनेट खर्च)", "Cash/Bank Exp", "=Trial_Balance!F28", False, False, False),
        (25, "   Stationery & Printing (स्टेशनरी खर्च)", "Cash/Bank Exp", "=Trial_Balance!F29", False, False, False),
        (26, "   Depreciation Expense (ह्रासकट्टी खर्च)", "Journal JV", "=Trial_Balance!F31", False, False, False),
        (27, "TOTAL OPERATING EXPENSES (कुल सञ्चालन खर्च) [C]", "", "=SUM(D20:D26)", False, True, False),
        (28, "", "", "", False, False, False),
        (29, "NET PROFIT / (LOSS) BEFORE TAX (कर अघिको खुद नाफा/नोक्सान) [Gross Profit - C]", "", "=D17-D27", True, True, False)
    ]

    for item in pl_items:
        r_num, part, ref, form_val, is_hd, is_tot, is_sec = item
        ws_pl.merge_cells(f"A{r_num}:B{r_num}")
        ws_pl[f"A{r_num}"] = part
        ws_pl[f"C{r_num}"] = ref
        ws_pl[f"C{r_num}"].alignment = Alignment(horizontal="center")
        
        if form_val != "":
            ws_pl[f"D{r_num}"] = form_val
            ws_pl[f"D{r_num}"].number_format = '[$Rs. ]#,##0.00;([$Rs. ]#,##0.00);"-"'
            ws_pl[f"D{r_num}"].alignment = Alignment(horizontal="right")

        for c in range(1, 5):
            cell = ws_pl.cell(row=r_num, column=c)
            cell.font = font_data
            cell.border = box_border
            if is_sec:
                cell.fill = fill_light_blue
                cell.font = font_sub_header
            elif is_tot:
                cell.fill = fill_total
                cell.font = font_total
                cell.border = total_border
            if is_hd:
                cell.fill = fill_light_green
                cell.font = Font(name="Calibri", size=11, bold=True, color="065F46")

    # -------------------------------------------------------------
    # 9. SHEET: Balance_Sheet
    # -------------------------------------------------------------
    ws_bs = wb.create_sheet(title="Balance_Sheet")
    ws_bs.views.sheetView[0].showGridLines = True

    ws_bs.merge_cells("A1:F2")
    ws_bs["A1"] = "📑 BALANCE SHEET / STATEMENT OF FINANCIAL POSITION (वासलात)"
    ws_bs["A1"].font = font_title
    ws_bs["A1"].fill = fill_navy
    ws_bs["A1"].alignment = Alignment(horizontal="center", vertical="center")

    ws_bs.merge_cells("A3:B3")
    ws_bs["A3"] = "CAPITAL & LIABILITIES (पुँजी तथा दायित्व)"
    ws_bs["A3"].font = font_col_header
    ws_bs["A3"].fill = fill_slate
    ws_bs["A3"].alignment = Alignment(horizontal="left", indent=1)

    ws_bs["C3"] = "Amount (Rs.)"
    ws_bs["C3"].font = font_col_header
    ws_bs["C3"].fill = fill_slate
    ws_bs["C3"].alignment = Alignment(horizontal="right")

    ws_bs.merge_cells("D3:E3")
    ws_bs["D3"] = "ASSETS & PROPERTIES (सम्पत्ति तथा जायजेथा)"
    ws_bs["D3"].font = font_col_header
    ws_bs["D3"].fill = fill_slate
    ws_bs["D3"].alignment = Alignment(horizontal="left", indent=1)

    ws_bs["F3"] = "Amount (Rs.)"
    ws_bs["F3"].font = font_col_header
    ws_bs["F3"].fill = fill_slate
    ws_bs["F3"].alignment = Alignment(horizontal="right")

    for c in range(1, 7):
        ws_bs.cell(row=3, column=c).border = box_border

    bs_rows = [
        # (Row, LiabName, LiabRef, LiabAmt, AssetName, AssetRef, AssetAmt, isHeader, isTotal, isSection)
        (4, "1. PROPRIETOR CAPITAL & EQUITY", "", "", "1. FIXED ASSETS (स्थिर सम्पत्ति)", "", "", False, False, True),
        (5, "   Owner Capital (सुरुको पुँजी)", "COA 3010", "=Trial_Balance!G18", "   Furniture & Fixtures", "COA 1510", "=Trial_Balance!F11", False, False, False),
        (6, "   Add: Current Net Profit", "P&L Statement", "=Profit_and_Loss!D29", "   Computer & Office Equipment", "COA 1520", "=Trial_Balance!F12", False, False, False),
        (7, "   Less: Owner Personal Drawings", "COA 3020", "=-Trial_Balance!F19", "   Less: Accumulated Depreciation", "COA 1530", "=-Trial_Balance!G13", False, False, False),
        (8, "NET OWNER EQUITY (खुद पुँजी)", "", "=SUM(C5:C7)", "NET FIXED ASSETS (खुद स्थिर सम्पत्ति)", "", "=SUM(F5:F7)", False, True, False),
        (9, "", "", "", "", "", "", False, False, False),
        (10, "2. LONG TERM LIABILITIES (दीर्घकालीन ऋण)", "", "", "2. CURRENT ASSETS (चालु सम्पत्ति)", "", "", False, False, True),
        (11, "   Bank Loan (Nabil Overdraft)", "COA 2100", "=Trial_Balance!G17", "   Closing Stock in Hand (मौज्दात)", "P&L Schedule", "=Profit_and_Loss!D14", False, False, False),
        (12, "TOTAL LONG TERM LOANS", "", "=C11", "   Sundry Debtors (ग्राहक आसामी)", "COA 1100", "=Trial_Balance!F8", False, False, False),
        (13, "", "", "", "   Cash in Hand (नगद मौज्दात)", "COA 1010", "=Trial_Balance!H4", False, False, False),
        (14, "3. CURRENT LIABILITIES (चालु दायित्व)", "", "", "   Nabil Bank Current A/C", "COA 1020", "=Trial_Balance!H5", False, False, False),
        (15, "   Sundry Creditors (साहु)", "COA 2010", "=Trial_Balance!G14", "   Global IME Bank A/C", "COA 1030", "=Trial_Balance!H6", False, False, False),
        (16, "   Salary Payable (बाँकी तलब)", "COA 2030", "=Trial_Balance!G16", "   eSewa / Digital Wallet", "COA 1040", "=Trial_Balance!H7", False, False, False),
        (17, "   Net VAT Payable (तिर्न बाँकी भ्याट)", "VAT Summary", "=MAX(0, VAT_Summary!D16)", "   VAT Receivable / Credit", "VAT Summary", "=MAX(0, -VAT_Summary!D16)", False, False, False),
        (18, "TOTAL CURRENT LIABILITIES", "", "=SUM(C15:C17)", "TOTAL CURRENT ASSETS", "", "=SUM(F11:F17)", False, True, False),
        (19, "", "", "", "", "", "", False, False, False),
        (20, "TOTAL LIABILITIES & EQUITY [१+२+३]", "", "=C8+C12+C18", "TOTAL ASSETS & PROPERTIES [१+२]", "", "=F8+F18", True, True, False)
    ]

    for item in bs_rows:
        r_num, l_name, l_ref, l_amt, a_name, a_ref, a_amt, is_hd, is_tot, is_sec = item
        ws_bs.merge_cells(f"A{r_num}:B{r_num}")
        ws_bs[f"A{r_num}"] = l_name
        if l_amt != "":
            ws_bs[f"C{r_num}"] = l_amt
            ws_bs[f"C{r_num}"].number_format = '[$Rs. ]#,##0.00;([$Rs. ]#,##0.00);"-"'
            ws_bs[f"C{r_num}"].alignment = Alignment(horizontal="right")

        ws_bs.merge_cells(f"D{r_num}:E{r_num}")
        ws_bs[f"D{r_num}"] = a_name
        if a_amt != "":
            ws_bs[f"F{r_num}"] = a_amt
            ws_bs[f"F{r_num}"].number_format = '[$Rs. ]#,##0.00;([$Rs. ]#,##0.00);"-"'
            ws_bs[f"F{r_num}"].alignment = Alignment(horizontal="right")

        for c in range(1, 7):
            cell = ws_bs.cell(row=r_num, column=c)
            cell.font = font_data
            cell.border = box_border
            if is_sec:
                cell.fill = fill_light_blue
                cell.font = font_sub_header
            elif is_tot:
                cell.fill = fill_total
                cell.font = font_total
                cell.border = total_border
            if is_hd:
                cell.fill = fill_light_green
                cell.font = Font(name="Calibri", size=11, bold=True, color="065F46")

    # Audit Validation Box in Balance Sheet
    ws_bs.merge_cells("A23:F23")
    ws_bs["A23"] = "🔍 AUDIT & BALANCE SHEET EQUATION VERIFICATION (लेखापरीक्षण प्रमाणिकरण)"
    ws_bs["A23"].font = font_col_header
    ws_bs["A23"].fill = fill_slate
    ws_bs["A23"].alignment = Alignment(horizontal="center")

    ws_bs.merge_cells("A24:C24")
    ws_bs["A24"] = "Total Assets - Total Liabilities & Equity Difference:"
    ws_bs["A24"].font = font_data_bold
    ws_bs["A24"].alignment = Alignment(horizontal="left", indent=1)

    ws_bs["D24"] = "=F20-C20"
    ws_bs["D24"].font = font_data_bold
    ws_bs["D24"].number_format = '#,##0.00;(#,##0.00);"-"'
    ws_bs["D24"].alignment = Alignment(horizontal="center")

    ws_bs.merge_cells("E24:F24")
    ws_bs["E24"] = '=IF(ROUND(D24,2)=0,"✅ BALANCED (वासलात १००% मिल्यो)","❌ MISMATCH (फरक छ!)")'
    ws_bs["E24"].font = font_title
    ws_bs["E24"].fill = fill_light_green
    ws_bs["E24"].alignment = Alignment(horizontal="center", vertical="center")

    for r in [23, 24]:
        for c in range(1, 7):
            ws_bs.cell(row=r, column=c).border = box_border

    # Signatures
    ws_bs.merge_cells("A27:B27")
    ws_bs["A27"] = "_______________________\nतयार गर्ने (Prepared By)\nAccountant"
    ws_bs["A27"].alignment = Alignment(horizontal="center", wrap_text=True)

    ws_bs.merge_cells("C27:D27")
    ws_bs["C27"] = "_______________________\nप्रमाणित गर्ने (Approved By)\nProprietor / Director"
    ws_bs["C27"].alignment = Alignment(horizontal="center", wrap_text=True)

    ws_bs.merge_cells("E27:F27")
    ws_bs["E27"] = "_______________________\nलेखापरीक्षक (Auditor / CA)\nAuditor Signature & Stamp"
    ws_bs["E27"].alignment = Alignment(horizontal="center", wrap_text=True)

    # -------------------------------------------------------------
    # 10. SHEET: VAT_Summary
    # -------------------------------------------------------------
    ws_vat = wb.create_sheet(title="VAT_Summary")
    ws_vat.views.sheetView[0].showGridLines = True

    ws_vat.merge_cells("A1:E2")
    ws_vat["A1"] = "🏛️ NEPAL VAT SUMMARY & TAX RETURN RECONCILIATION (भ्याट विवरण)"
    ws_vat["A1"].font = font_title
    ws_vat["A1"].fill = fill_navy
    ws_vat["A1"].alignment = Alignment(horizontal="center", vertical="center")

    vat_table = [
        ("PARTICULARS (विवरण)", "Reference", "Amount (Rs.)", True, False),
        ("1. Total Sales (कुल बिक्री)", "Sales Register Total", "=Sales_Register!H50", False, False),
        ("   a. Taxable Sales (करयोग्य बिक्री)", "Sales Register Taxable", "=Sales_Register!E50", False, False),
        ("   b. Non-Taxable / Exempt Sales (कर छुट बिक्री)", "Sales Register Exempt", "=Sales_Register!F50", False, False),
        ("   c. 13% Output VAT Collected (उठाएको भ्याट) [A]", "Sales Register VAT", "=Sales_Register!G50", True, False),
        ("", "", "", False, False),
        ("2. Total Purchases (कुल खरिद)", "Purchase Register Total", "=Purchase_Register!H50", False, False),
        ("   a. Taxable Purchase (करयोग्य खरिद)", "Purchase Register Taxable", "=Purchase_Register!E50", False, False),
        ("   b. Non-Taxable Purchase (कर छुट खरिद)", "Purchase Register Exempt", "=Purchase_Register!F50", False, False),
        ("   c. 13% Input VAT Paid (तिरेको भ्याट कट्टी) [B]", "Purchase Register VAT", "=Purchase_Register!G50", True, False),
        ("", "", "", False, False),
        ("3. Opening VAT Credit from Previous Month [C]", "Tax Filing History", 0, False, False),
        ("", "", "", False, False),
        ("NET VAT PAYABLE TO IRD / (CREDIT) [A - B - C]", "Formula Calculation", "=D7-D12-D14", True, True)
    ]

    for idx, item in enumerate(vat_table, start=3):
        part, ref, amt, is_bold, is_highlight = item
        ws_vat.merge_cells(f"A{idx}:B{idx}")
        ws_vat[f"A{idx}"] = part
        ws_vat[f"C{idx}"] = ref
        ws_vat[f"C{idx}"].alignment = Alignment(horizontal="center")
        
        if amt != "":
            ws_vat[f"D{idx}"] = amt
            if isinstance(amt, str) and amt.startswith("="):
                ws_vat[f"D{idx}"].number_format = '[$Rs. ]#,##0.00;([$Rs. ]#,##0.00);"-"'
            elif isinstance(amt, (int, float)):
                ws_vat[f"D{idx}"].number_format = '[$Rs. ]#,##0.00;([$Rs. ]#,##0.00);"-"'
            ws_vat[f"D{idx}"].alignment = Alignment(horizontal="right")

        for c in range(1, 5):
            cell = ws_vat.cell(row=idx, column=c)
            cell.font = font_data_bold if is_bold else font_data
            cell.border = box_border
            if idx == 3:
                cell.fill = fill_slate
                cell.font = font_col_header
            elif is_highlight:
                cell.fill = fill_light_green
                cell.font = Font(name="Calibri", size=11, bold=True, color="065F46")

    # Column Width Auto-Adjustment for all sheets
    for ws in wb.worksheets:
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                # ignore merged cells in row 1-2 for width
                if cell.row in [1, 2]:
                    continue
                val_str = str(cell.value or '')
                if len(val_str) > max_len:
                    max_len = len(val_str)
            ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

    # Custom tweaks for key sheet column widths
    ws_dash.column_dimensions['A'].width = 8
    ws_dash.column_dimensions['B'].width = 24
    ws_dash.column_dimensions['C'].width = 16
    ws_dash.column_dimensions['D'].width = 24
    ws_dash.column_dimensions['E'].width = 16
    ws_dash.column_dimensions['F'].width = 24
    ws_dash.column_dimensions['G'].width = 16
    ws_dash.column_dimensions['H'].width = 24
    ws_dash.column_dimensions['I'].width = 16
    ws_dash.column_dimensions['J'].width = 24
    ws_dash.column_dimensions['K'].width = 16

    target_path = "d:/Developing/KhataPlus/KhataPlus_Accounting_System_Final.xlsx"
    wb.save(target_path)
    print(f"Successfully generated Excel Workbook at: {target_path}")

if __name__ == "__main__":
    build_accounting_workbook()
