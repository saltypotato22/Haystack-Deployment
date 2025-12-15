/**
 * Excel Handler Module
 * Import/Export Excel files with formula preservation
 */

(function(window) {
    'use strict';

    /**
     * Import Excel file with formula preservation
     * Uses header-based column mapping for flexibility
     * Auto-generates ID_xA from Group-Node if missing
     * @param {File} file - Excel file object
     * @returns {Promise<Array>} Promise resolving to array of node objects
     */
    const importExcel = async function(file) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(await file.arrayBuffer());

        const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
        if (!worksheet) {
            throw new Error('No worksheet found in Excel file');
        }

        // Build column map from header row
        const columnMap = {};
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell, colNumber) => {
            const headerName = getCellValue(cell).trim();
            if (headerName) {
                columnMap[headerName] = colNumber;
            }
        });

        // Helper to get value by column name (supports alternate names)
        const getColumnValue = (row, ...columnNames) => {
            for (const name of columnNames) {
                if (columnMap[name]) {
                    return getCellValue(row.getCell(columnMap[name]));
                }
            }
            return '';
        };

        const nodes = [];

        worksheet.eachRow((row, rowNumber) => {
            // Skip header row
            if (rowNumber === 1) return;

            // Column name translation: New clean names first, old _xA/_xB names as fallback
            // Internal fields still use _xA/_xB for code clarity
            const group = getColumnValue(row, 'Group', 'Group_xA');
            const nodeName = getColumnValue(row, 'Node', 'Node_xA');
            const id = getColumnValue(row, 'ID', 'ID_xA');

            // Parse AI_Rank (keep as empty string or integer 0-100)
            const aiRankRaw = getColumnValue(row, 'AI_Rank', 'AI Rank', 'AI_Rank_xB');
            const aiRank = aiRankRaw === '' ? '' : (parseInt(aiRankRaw) || 0);

            // Parse Rank (keep as empty string or integer 0-3)
            const rankRaw = getColumnValue(row, 'Rank', 'Rank_xB', 'User_Rank');
            const rank = rankRaw === '' ? '' : (parseInt(rankRaw) || 0);

            const node = {
                Group_xA: group,
                Node_xA: nodeName,
                ID_xA: id || `${group}-${nodeName}`,  // Auto-generate ID if not provided
                // Link columns accepted for backward compat but stored as empty (feature deprecated)
                Linked_Node_ID_xA: '',
                Hidden_Node_xB: parseInt(getColumnValue(row, 'Hide_Node', 'Hide Node', 'Hidden_Node_xB', 'Hidden Node_xB')) || 0,
                Hidden_Link_xB: 0,
                Link_Label_xB: '',
                Link_Arrow_xB: 'To',
                AI_Rank_xB: aiRank,
                Rank_xB: rank,
                Root1_xB: getColumnValue(row, 'Root1', 'Root1_xB') || '',
                Class1_xB: getColumnValue(row, 'Class1', 'Class1_xB') || '',
                Root2_xB: getColumnValue(row, 'Root2', 'Root2_xB') || '',
                Class2_xB: getColumnValue(row, 'Class2', 'Class2_xB') || '',
                Root3_xB: getColumnValue(row, 'Root3', 'Root3_xB') || '',
                Class3_xB: getColumnValue(row, 'Class3', 'Class3_xB') || '',
                Group_Info: getColumnValue(row, 'Group_Info') || '',
                Node_Info: getColumnValue(row, 'Node_Info') || ''
            };

            // Only add if row has data
            if (node.Group_xA || node.Node_xA) {
                nodes.push(node);
            }
        });

        return nodes;
    };

    /**
     * Get cell value, handling formulas
     * @param {Object} cell - ExcelJS cell object
     * @returns {String} Cell value
     */
    const getCellValue = function(cell) {
        if (!cell || cell.value === null || cell.value === undefined) {
            return '';
        }

        // If cell contains formula, use the cached result
        if (cell.type === ExcelJS.ValueType.Formula) {
            return cell.result || '';
        }

        return String(cell.value || '');
    };

    /**
     * Export nodes to Excel with formula preservation
     * Smart export: only include Group_Info/Node_Info if any values exist
     * @param {Array} nodes - Array of node objects
     * @param {String} filename - Output filename
     */
    const exportExcel = async function(nodes, filename) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sheet1');

        // Check if optional columns have any non-empty values
        const hasAnyAIRank = nodes.some(n => n.AI_Rank_xB !== '' && n.AI_Rank_xB !== undefined);
        const hasAnyRank = nodes.some(n => n.Rank_xB !== '' && n.Rank_xB !== undefined);
        const hasAnyRoot1 = nodes.some(n => n.Root1_xB && n.Root1_xB.trim());
        const hasAnyClass1 = nodes.some(n => n.Class1_xB && n.Class1_xB.trim());
        const hasAnyRoot2 = nodes.some(n => n.Root2_xB && n.Root2_xB.trim());
        const hasAnyClass2 = nodes.some(n => n.Class2_xB && n.Class2_xB.trim());
        const hasAnyRoot3 = nodes.some(n => n.Root3_xB && n.Root3_xB.trim());
        const hasAnyClass3 = nodes.some(n => n.Class3_xB && n.Class3_xB.trim());
        const hasAnyGroupInfo = nodes.some(n => n.Group_Info && n.Group_Info.trim());
        const hasAnyNodeInfo = nodes.some(n => n.Node_Info && n.Node_Info.trim());

        // Build headers dynamically (link columns removed - feature deprecated)
        // Export uses clean column names (translation layer)
        const headers = [
            'Group',
            'Node',
            'ID'
        ];
        if (hasAnyAIRank) headers.push('AI_Rank');
        if (hasAnyRank) headers.push('Rank');
        if (hasAnyRoot1) headers.push('Root1');
        if (hasAnyClass1) headers.push('Class1');
        if (hasAnyRoot2) headers.push('Root2');
        if (hasAnyClass2) headers.push('Class2');
        if (hasAnyRoot3) headers.push('Root3');
        if (hasAnyClass3) headers.push('Class3');
        if (hasAnyGroupInfo) headers.push('Group_Info');
        if (hasAnyNodeInfo) headers.push('Node_Info');

        worksheet.addRow(headers);

        // Style header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE5E7EB' }
        };

        // Add data rows with formulas for ID_xA
        nodes.forEach((node, index) => {
            const rowNumber = index + 2; // +1 for header, +1 for 0-index

            // Build row data dynamically (link columns removed - feature deprecated)
            const rowData = [
                node.Group_xA,
                node.Node_xA,
                '' // Will be replaced with formula
            ];
            if (hasAnyAIRank) rowData.push(node.AI_Rank_xB !== undefined ? node.AI_Rank_xB : '');
            if (hasAnyRank) rowData.push(node.Rank_xB !== undefined ? node.Rank_xB : '');
            if (hasAnyRoot1) rowData.push(node.Root1_xB || '');
            if (hasAnyClass1) rowData.push(node.Class1_xB || '');
            if (hasAnyRoot2) rowData.push(node.Root2_xB || '');
            if (hasAnyClass2) rowData.push(node.Class2_xB || '');
            if (hasAnyRoot3) rowData.push(node.Root3_xB || '');
            if (hasAnyClass3) rowData.push(node.Class3_xB || '');
            if (hasAnyGroupInfo) rowData.push(node.Group_Info || '');
            if (hasAnyNodeInfo) rowData.push(node.Node_Info || '');

            const row = worksheet.addRow(rowData);

            // Set formula for ID_xA (column C)
            // Formula: =A2&"-"&B2
            const idCell = worksheet.getCell(`C${rowNumber}`);
            idCell.value = {
                formula: `A${rowNumber}&"-"&B${rowNumber}`,
                result: node.ID_xA
            };
        });

        // Auto-fit columns
        worksheet.columns.forEach((column, index) => {
            let maxLength = 10;
            column.eachCell({ includeEmpty: true }, cell => {
                const length = String(cell.value).length;
                if (length > maxLength) {
                    maxLength = length;
                }
            });
            column.width = Math.min(maxLength + 2, 50);
        });

        // Download file
        const buffer = await workbook.xlsx.writeBuffer();
        downloadBlob(buffer, filename || 'graph-data.xlsx',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    };

    /**
     * Helper to download blob as file
     * @param {Buffer|Blob} data - Data to download
     * @param {String} filename - Filename
     * @param {String} mimeType - MIME type
     */
    const downloadBlob = function(data, filename, mimeType) {
        const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Expose to global namespace
    window.GraphApp.core.importExcel = importExcel;
    window.GraphApp.core.exportExcel = exportExcel;

})(window);
