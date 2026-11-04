"""Recover decimal prices accidentally formatted as d.m dates by Google Sheets."""
from datetime import datetime, timedelta
import re


def column_letter(index):
    result = ''
    index += 1
    while index:
        index, remainder = divmod(index-1, 26)
        result = chr(65+remainder)+result
    return result


def restore_price_dates(values, sheets, price_columns):
    """Only d.m DATE cells whose displayed day/month match their serial are restored."""
    restored = [list(row) for row in values]
    count = 0
    for sheet in sheets:
        for block in sheet.get('data', []):
            first_row, first_column = block.get('startRow', 0), block.get('startColumn', 0)
            for r, row in enumerate(block.get('rowData', []), first_row):
                for c, cell in enumerate(row.get('values', []), first_column):
                    if r == 0 or r >= len(restored) or c not in price_columns or c >= len(restored[r]):
                        continue
                    fmt = cell.get('effectiveFormat', {}).get('numberFormat', {})
                    if fmt.get('type') not in ('DATE', 'DATE_TIME'):
                        continue
                    text = cell.get('formattedValue', '')
                    match = re.fullmatch(r'(\d{1,2})\.(\d{1,2})', text)
                    if fmt.get('pattern') != 'd.m' or not match:
                        raise ValueError('Format de prix converti en date non reconnu : vérification nécessaire.')
                    try:
                        serial = float(restored[r][c])
                        date = datetime(1899, 12, 30)+timedelta(days=serial)
                    except (ValueError, TypeError, OverflowError):
                        raise ValueError('Format de prix converti en date invalide.') from None
                    if (date.day, date.month) != tuple(map(int, match.groups())):
                        raise ValueError('Format de prix converti en date incohérent.')
                    restored[r][c] = float(text)
                    count += 1
    return restored, count
