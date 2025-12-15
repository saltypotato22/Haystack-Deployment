/**
 * Export Functions Module
 * Export data to various formats (CSV, PNG, Mermaid)
 */

(function(window) {
    'use strict';

    /**
     * Build CSV column list based on whether info columns have data
     * Uses clean column names (translation layer)
     * @param {Array} nodes - Array of node objects
     * @param {Set} blockedRoots - Optional set of blocked root strings
     * @returns {Array} Column names for CSV export
     */
    const getCSVColumns = function(nodes, blockedRoots) {
        const hasAnyAIRank = nodes.some(n => n.AI_Rank_xB !== '' && n.AI_Rank_xB !== undefined && n.AI_Rank_xB !== null);
        const hasAnyRank = nodes.some(n => n.Rank_xB !== '' && n.Rank_xB !== undefined && n.Rank_xB !== null);
        const hasAnyRoot1 = nodes.some(n => n.Root1_xB && n.Root1_xB.trim());
        const hasAnyClass1 = nodes.some(n => n.Class1_xB && n.Class1_xB.trim());
        const hasAnyRoot2 = nodes.some(n => n.Root2_xB && n.Root2_xB.trim());
        const hasAnyClass2 = nodes.some(n => n.Class2_xB && n.Class2_xB.trim());
        const hasAnyRoot3 = nodes.some(n => n.Root3_xB && n.Root3_xB.trim());
        const hasAnyClass3 = nodes.some(n => n.Class3_xB && n.Class3_xB.trim());
        const hasAnyGroupInfo = nodes.some(n => n.Group_Info && n.Group_Info.trim());
        const hasAnyNodeInfo = nodes.some(n => n.Node_Info && n.Node_Info.trim());

        // Check if any roots are blocked (for Blocked1/2/3 columns)
        const rootsSet = blockedRoots || new Set();
        const hasAnyBlocked1 = hasAnyRoot1 && nodes.some(n => n.Root1_xB && rootsSet.has(n.Root1_xB));
        const hasAnyBlocked2 = hasAnyRoot2 && nodes.some(n => n.Root2_xB && rootsSet.has(n.Root2_xB));
        const hasAnyBlocked3 = hasAnyRoot3 && nodes.some(n => n.Root3_xB && rootsSet.has(n.Root3_xB));

        // Clean column names for export (link columns removed - feature deprecated)
        const columns = [
            'Group',
            'Node',
            'ID'
        ];
        if (hasAnyAIRank) columns.push('AI_Rank');
        if (hasAnyRank) columns.push('Rank');
        if (hasAnyRoot1) columns.push('Root1');
        if (hasAnyClass1) columns.push('Class1');
        if (hasAnyBlocked1) columns.push('Blocked1');
        if (hasAnyRoot2) columns.push('Root2');
        if (hasAnyClass2) columns.push('Class2');
        if (hasAnyBlocked2) columns.push('Blocked2');
        if (hasAnyRoot3) columns.push('Root3');
        if (hasAnyClass3) columns.push('Class3');
        if (hasAnyBlocked3) columns.push('Blocked3');
        if (hasAnyGroupInfo) columns.push('Group_Info');
        if (hasAnyNodeInfo) columns.push('Node_Info');

        return columns;
    };

    /**
     * Transform nodes to clean export format
     * Maps internal _xA/_xB field names to clean external names
     * @param {Array} nodes - Array of node objects with internal names
     * @param {Set} blockedRoots - Optional set of blocked root strings
     * @returns {Array} Array with clean column names
     */
    const transformForExport = function(nodes, blockedRoots) {
        const rootsSet = blockedRoots || new Set();
        return nodes.map(node => ({
            'Group': node.Group_xA || '',
            'Node': node.Node_xA || '',
            'ID': node.ID_xA || '',
            'AI_Rank': (node.AI_Rank_xB !== '' && node.AI_Rank_xB !== undefined && node.AI_Rank_xB !== null) ? node.AI_Rank_xB : '',
            'Rank': (node.Rank_xB !== '' && node.Rank_xB !== undefined && node.Rank_xB !== null) ? node.Rank_xB : '',
            'Root1': node.Root1_xB || '',
            'Class1': node.Class1_xB || '',
            'Blocked1': (node.Root1_xB && rootsSet.has(node.Root1_xB)) ? 1 : '',
            'Root2': node.Root2_xB || '',
            'Class2': node.Class2_xB || '',
            'Blocked2': (node.Root2_xB && rootsSet.has(node.Root2_xB)) ? 1 : '',
            'Root3': node.Root3_xB || '',
            'Class3': node.Class3_xB || '',
            'Blocked3': (node.Root3_xB && rootsSet.has(node.Root3_xB)) ? 1 : '',
            'Group_Info': node.Group_Info || '',
            'Node_Info': node.Node_Info || ''
        }));
    };

    /**
     * Export nodes to CSV
     * Smart export: only include Group_Info/Node_Info if any values exist
     * Uses clean column names (translation layer)
     * @param {Array} nodes - Array of node objects
     * @param {String} filename - Output filename
     * @param {Set} blockedRoots - Optional set of blocked root strings
     */
    const exportCSV = function(nodes, filename, blockedRoots) {
        // Use helper to get smart column list
        const columns = getCSVColumns(nodes, blockedRoots);

        // Transform to clean column names for export
        const exportData = transformForExport(nodes, blockedRoots);

        // Use PapaParse to generate CSV
        const csv = Papa.unparse(exportData, {
            header: true,
            columns: columns
        });

        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'graph-data.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * Export nodes to Roots CSV format
     * Columns: class, root, class_description, engagement
     * @param {Array} nodes - Array of node objects
     * @param {String} filename - Output filename
     */
    const exportRootsCSV = function(nodes, filename) {
        const columns = ['class', 'root', 'class_description', 'engagement'];

        const exportData = nodes.map(node => ({
            'class': node.Group_xA || '',
            'root': node.Node_xA || '',
            'class_description': node.Group_Info || '',
            'engagement': (node.AI_Rank_xB !== '' && node.AI_Rank_xB !== undefined && node.AI_Rank_xB !== null)
                ? node.AI_Rank_xB : ''
        }));

        const csv = Papa.unparse(exportData, {
            header: true,
            columns: columns
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'roots.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * Generate CSV string from nodes (reusable for TXT export and clipboard)
     * Smart export: only include Group_Info/Node_Info if any values exist
     * Uses clean column names (translation layer)
     * @param {Array} nodes - Array of node objects
     * @param {Set} blockedRoots - Optional set of blocked root strings
     * @returns {String} CSV-formatted string
     */
    const generateCSVString = function(nodes, blockedRoots) {
        // Use helper to get smart column list
        const columns = getCSVColumns(nodes, blockedRoots);

        // Transform to clean column names for export
        const exportData = transformForExport(nodes, blockedRoots);

        return Papa.unparse(exportData, {
            header: true,
            columns: columns
        });
    };

    /**
     * Export nodes to TXT (same format as CSV)
     * @param {Array} nodes - Array of node objects
     * @param {String} filename - Output filename
     * @param {Set} blockedRoots - Optional set of blocked root strings
     */
    const exportTXT = function(nodes, filename, blockedRoots) {
        const txt = generateCSVString(nodes, blockedRoots);
        const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'graph-data.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * Copy nodes to clipboard as CSV text
     * Uses modern Clipboard API (96%+ browser support)
     * @param {Array} nodes - Array of node objects
     * @param {Set} blockedRoots - Optional set of blocked root strings
     * @returns {Promise<boolean>} Success status
     */
    const copyToClipboard = async function(nodes, blockedRoots) {
        const csv = generateCSVString(nodes, blockedRoots);
        try {
            await navigator.clipboard.writeText(csv);
            return true;
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            return false;
        }
    };

    /**
     * Import CSV file
     * Accepts both new clean column names and old _xA/_xB names (backward compatible)
     * @param {File} file - CSV file object
     * @returns {Promise<Object>} Promise resolving to { nodes, format, blockedRoots }
     */
    const importCSV = function(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: function(results) {
                    // Collect blocked roots from Blocked1/2/3 columns
                    const blockedRoots = new Set();

                    // Column name translation: New clean names first, old _xA/_xB names as fallback
                    // Internal fields still use _xA/_xB for code clarity
                    const nodes = results.data.map(row => {
                        // Primary fields - new names first, old as fallback, roots format aliases last
                        // Always stringify to handle dynamicTyping converting numeric values
                        const group = String(row.Group || row.Group_xA || row.class || '');
                        const nodeName = String(row.Node || row.Node_xA || row.root || '');
                        const id = String(row.ID || row.ID_xA || '');

                        // Parse AI_Rank - accept 'AI_Rank' (new), 'AI_Rank_xB' (old), or 'engagement' (roots format)
                        const aiRankVal = row.AI_Rank !== undefined ? row.AI_Rank
                            : (row['AI Rank'] !== undefined ? row['AI Rank']
                            : (row.AI_Rank_xB !== undefined ? row.AI_Rank_xB
                            : (row.engagement !== undefined ? row.engagement
                            : '')));

                        // Parse Rank - accept 'Rank' (new) or 'Rank_xB' (old), default to empty
                        const rankVal = row.Rank !== undefined ? row.Rank : (row.Rank_xB !== undefined ? row.Rank_xB : '');

                        // Extract root values
                        const root1 = row.Root1 || row.Root1_xB || '';
                        const root2 = row.Root2 || row.Root2_xB || '';
                        const root3 = row.Root3 || row.Root3_xB || '';

                        // Check Blocked1/2/3 columns and collect blocked roots
                        // Columns are optional - if missing, roots are not blocked
                        const blocked1 = row.Blocked1 === 1 || row.Blocked1 === '1';
                        const blocked2 = row.Blocked2 === 1 || row.Blocked2 === '1';
                        const blocked3 = row.Blocked3 === 1 || row.Blocked3 === '1';

                        if (blocked1 && root1) blockedRoots.add(root1);
                        if (blocked2 && root2) blockedRoots.add(root2);
                        if (blocked3 && root3) blockedRoots.add(root3);

                        return {
                            Group_xA: group,
                            Node_xA: nodeName,
                            ID_xA: id || `${group}-${nodeName}`,  // Auto-generate ID if not provided
                            // Link columns accepted for backward compat but stored as empty (feature deprecated)
                            Linked_Node_ID_xA: '',
                            Hidden_Node_xB: parseInt(row.Hide_Node || row['Hide Node'] || row.Hidden_Node_xB || row['Hidden Node_xB']) || 0,
                            Hidden_Link_xB: 0,
                            Link_Label_xB: '',
                            Link_Arrow_xB: 'To',
                            AI_Rank_xB: (aiRankVal === '' || aiRankVal === null || aiRankVal === undefined) ? '' : parseInt(aiRankVal),
                            Rank_xB: (rankVal === '' || rankVal === null || rankVal === undefined) ? '' : parseInt(rankVal),
                            Root1_xB: root1,
                            Class1_xB: row.Class1 || row.Class1_xB || '',
                            Root2_xB: root2,
                            Class2_xB: row.Class2 || row.Class2_xB || '',
                            Root3_xB: root3,
                            Class3_xB: row.Class3 || row.Class3_xB || '',
                            Group_Info: row.Group_Info || row.class_description || '',
                            Node_Info: row.Node_Info || ''
                        };
                    });

                    // Detect format from column names
                    const headers = Object.keys(results.data[0] || {});
                    const isRootsFormat = headers.includes('class') && headers.includes('root');
                    const format = isRootsFormat ? 'roots' : 'candidates';

                    // Legacy scale detection for roots format
                    // If max engagement value is <= 5, assume old 0-5 scale and convert to 0-100
                    if (isRootsFormat) {
                        const numericScores = nodes
                            .map(n => n.AI_Rank_xB)
                            .filter(v => v !== '' && v !== null && v !== undefined && !isNaN(v));

                        if (numericScores.length > 0) {
                            const maxScore = Math.max(...numericScores);
                            if (maxScore <= 5) {
                                // Legacy 0-5 scale detected - convert to 0-100
                                console.log('Legacy 0-5 engagement scale detected, converting to 0-100');
                                nodes.forEach(n => {
                                    if (n.AI_Rank_xB !== '' && n.AI_Rank_xB !== null && n.AI_Rank_xB !== undefined) {
                                        // Convert: multiply by 20, handle negatives as 0
                                        const oldValue = n.AI_Rank_xB;
                                        n.AI_Rank_xB = oldValue < 0 ? 0 : Math.round(oldValue * 20);
                                    }
                                });
                            }
                        }
                    }

                    resolve({ nodes, format, blockedRoots });
                },
                error: function(error) {
                    reject(error);
                }
            });
        });
    };

    /**
     * Export Mermaid diagram to .mmd file
     * @param {String} mermaidSyntax - Mermaid diagram syntax
     * @param {String} filename - Output filename
     */
    const exportMermaid = function(mermaidSyntax, filename) {
        const blob = new Blob([mermaidSyntax], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'graph.mmd';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * Import Mermaid .mmd file
     * @param {File} file - Mermaid file object
     * @returns {Promise<Array>} Promise resolving to array of node objects
     */
    const importMermaid = async function(file) {
        const text = await file.text();
        return window.GraphApp.utils.parseMermaidToNodes(text);
    };

    /**
     * Export nodes to JSON
     * @param {Array} nodes - Array of node objects
     * @param {String} filename - Output filename
     */
    const exportJSON = function(nodes, filename) {
        const jsonData = JSON.stringify(nodes, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'graph-data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    /**
     * Export nodes to GraphML format (yEd-compatible with full visual data)
     * @param {Array} nodes - Array of node objects
     * @param {String} filename - Output filename
     */
    const exportGraphML = function(nodes, filename) {
        // Build yEd-compatible GraphML XML
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns"\n';
        xml += '         xmlns:java="http://www.yworks.com/xml/yfiles-common/1.0/java"\n';
        xml += '         xmlns:sys="http://www.yworks.com/xml/yfiles-common/markup/primitives/2.0"\n';
        xml += '         xmlns:x="http://www.yworks.com/xml/yfiles-common/markup/2.0"\n';
        xml += '         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n';
        xml += '         xmlns:y="http://www.yworks.com/xml/graphml"\n';
        xml += '         xmlns:yed="http://www.yworks.com/xml/yed/3"\n';
        xml += '         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://www.yworks.com/xml/schema/graphml/1.1/ygraphml.xsd">\n';

        // Define yEd data keys (using clean attribute names)
        xml += '  <key id="d0" for="port" yfiles.type="portgraphics"/>\n';
        xml += '  <key id="d1" for="port" yfiles.type="portgeometry"/>\n';
        xml += '  <key id="d2" for="port" yfiles.type="portuserdata"/>\n';
        xml += '  <key id="d3" for="node" attr.name="Group" attr.type="string"/>\n';
        xml += '  <key id="d4" for="node" attr.name="Node" attr.type="string"/>\n';
        xml += '  <key id="d5" for="node" attr.name="ID" attr.type="string"/>\n';
        xml += '  <key id="d6" for="node" attr.name="url" attr.type="string"/>\n';
        xml += '  <key id="d7" for="node" attr.name="description" attr.type="string"/>\n';
        xml += '  <key id="d8" for="node" yfiles.type="nodegraphics"/>\n';
        xml += '  <key id="d9" for="graphml" yfiles.type="resources"/>\n';
        xml += '  <key id="d10" for="edge" attr.name="Link_Label" attr.type="string"/>\n';
        xml += '  <key id="d11" for="edge" attr.name="url" attr.type="string"/>\n';
        xml += '  <key id="d12" for="edge" attr.name="description" attr.type="string"/>\n';
        xml += '  <key id="d13" for="edge" yfiles.type="edgegraphics"/>\n';
        xml += '  <key id="d14" for="edge" attr.name="Arrow" attr.type="string"/>\n';

        xml += '  <graph id="G" edgedefault="directed">\n';

        // Group nodes by Group_xA
        const groups = {};
        const nodeIdMap = {}; // Maps ID_xA to yEd node ID (e.g., "n0::0")

        nodes.forEach(node => {
            const groupName = node.Group_xA || 'Ungrouped';
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(node);
        });

        const groupNames = Object.keys(groups);

        // Generate group container nodes with nested graphs
        groupNames.forEach((groupName, groupIndex) => {
            const groupNodes = groups[groupName];
            const groupId = `n${groupIndex}`;

            // Group container node
            xml += `    <node id="${groupId}" yfiles.foldertype="group">\n`;
            xml += `      <data key="d3"/>\n`;
            xml += `      <data key="d4"/>\n`;
            xml += `      <data key="d5">${escapeXml(groupName)}</data>\n`;
            xml += `      <data key="d7"/>\n`;
            xml += `      <data key="d8">\n`;
            xml += `        <y:ProxyAutoBoundsNode>\n`;
            xml += `          <y:Realizers active="0">\n`;
            xml += `            <y:GroupNode>\n`;
            xml += `              <y:Geometry height="200.0" width="400.0" x="0.0" y="0.0"/>\n`;
            xml += `              <y:Fill color="#FFFFFF" transparent="false"/>\n`;
            xml += `              <y:BorderStyle color="#000000" type="dashed" width="1.0"/>\n`;
            xml += `              <y:NodeLabel alignment="center" autoSizePolicy="node_width" backgroundColor="#EBEBEB" borderDistance="0.0" fontFamily="Dialog" fontSize="18" fontStyle="plain" hasLineColor="false" height="26.0" horizontalTextPosition="center" iconTextGap="4" modelName="internal" modelPosition="tl" textColor="#000000" verticalTextPosition="bottom" visible="true" width="400.0" x="0.0" y="0.0">${escapeXml(groupName)}</y:NodeLabel>\n`;
            xml += `              <y:Shape type="roundrectangle"/>\n`;
            xml += `              <y:Insets bottom="15" left="15" right="15" top="15"/>\n`;
            xml += `              <y:BorderInsets bottom="0" left="0" right="0" top="0"/>\n`;
            xml += `            </y:GroupNode>\n`;
            xml += `          </y:Realizers>\n`;
            xml += `        </y:ProxyAutoBoundsNode>\n`;
            xml += `      </data>\n`;

            // Nested graph for child nodes
            xml += `      <graph edgedefault="directed" id="${groupId}:">\n`;

            // Add child nodes
            groupNodes.forEach((node, nodeIndex) => {
                const nodeId = `${groupId}::${nodeIndex}`;
                nodeIdMap[node.ID_xA] = nodeId;

                const nodeLabel = node.Node_xA || '';
                const yPos = nodeIndex * 120; // Vertical spacing

                xml += `        <node id="${nodeId}">\n`;
                xml += `          <data key="d3">${escapeXml(groupName)}</data>\n`;
                xml += `          <data key="d4">${escapeXml(nodeLabel)}</data>\n`;
                xml += `          <data key="d5">${escapeXml(node.ID_xA || '')}</data>\n`;
                xml += `          <data key="d7"/>\n`;
                xml += `          <data key="d8">\n`;
                xml += `            <y:ShapeNode>\n`;
                xml += `              <y:Geometry height="40.0" width="120.0" x="0.0" y="${yPos}"/>\n`;
                xml += `              <y:Fill color="#FFFFFF" transparent="false"/>\n`;
                xml += `              <y:BorderStyle color="#000000" raised="false" type="line" width="1.0"/>\n`;
                xml += `              <y:NodeLabel alignment="center" autoSizePolicy="content" fontFamily="Dialog" fontSize="12" fontStyle="plain" hasBackgroundColor="false" hasLineColor="false" height="20.0" horizontalTextPosition="center" iconTextGap="4" modelName="internal" modelPosition="c" textColor="#000000" verticalTextPosition="bottom" visible="true" width="100.0" x="10.0" y="10.0">${escapeXml(nodeLabel)}</y:NodeLabel>\n`;
                xml += `              <y:Shape type="roundrectangle"/>\n`;
                xml += `            </y:ShapeNode>\n`;
                xml += `          </data>\n`;
                xml += `        </node>\n`;
            });

            xml += `      </graph>\n`;
            xml += `    </node>\n`;
        });

        // Edge creation removed - link feature deprecated

        xml += '  </graph>\n';
        xml += '  <data key="d9">\n';
        xml += '    <y:Resources/>\n';
        xml += '  </data>\n';
        xml += '</graphml>\n';

        // Download
        const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'graph.graphml';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Helper function to escape XML special characters
    const escapeXml = function(str) {
        if (!str) return '';
        return str.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    };

    // Helper function to escape DOT special characters
    const escapeDot = function(str) {
        if (!str) return '';
        return str.toString()
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n');
    };

    /**
     * Export nodes to GraphViz DOT format
     * @param {Array} nodes - Array of node objects
     * @param {String} filename - Output filename
     * @param {Object} settings - Layout settings (for direction)
     */
    const exportDOT = function(nodes, filename, settings) {
        const direction = settings && settings.direction === 'LR' ? 'LR' : 'TB';

        let dot = 'digraph G {\n';
        dot += `    rankdir=${direction};\n`;
        dot += '    node [shape=box, style=rounded, fontname="Arial"];\n';
        dot += '    edge [fontname="Arial", fontsize=10];\n';
        dot += '    compound=true;\n\n';

        // Group nodes by Group_xA
        const groups = {};
        nodes.forEach(node => {
            const groupName = node.Group_xA || 'Ungrouped';
            if (!groups[groupName]) {
                groups[groupName] = [];
            }
            groups[groupName].push(node);
        });

        // Generate subgraphs for each group
        let clusterIndex = 0;
        Object.keys(groups).forEach(groupName => {
            const groupNodes = groups[groupName];

            dot += `    subgraph cluster_${clusterIndex} {\n`;
            dot += `        label="${escapeDot(groupName)}";\n`;
            dot += '        style=dashed;\n';
            dot += '        bgcolor="#f8f8f8";\n';

            // Add nodes in this group
            groupNodes.forEach(node => {
                const nodeId = escapeDot(node.ID_xA || '');
                const nodeLabel = escapeDot(node.Node_xA || '');
                dot += `        "${nodeId}" [label="${nodeLabel}"];\n`;
            });

            dot += '    }\n\n';
            clusterIndex++;
        });

        // Edge creation removed - link feature deprecated

        dot += '}\n';

        // Download
        const blob = new Blob([dot], { type: 'text/vnd.graphviz;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'graph.dot';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Expose to global namespace
    window.GraphApp.exports = {
        exportCSV,
        exportRootsCSV,
        importCSV,
        exportTXT,
        exportMermaid,
        importMermaid,
        exportJSON,
        exportGraphML,
        exportDOT,
        copyToClipboard
    };

})(window);

