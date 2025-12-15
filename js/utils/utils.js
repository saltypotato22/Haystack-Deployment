/**
 * Utility Functions
 * Helper functions for data validation and manipulation
 */

(function(window) {
    'use strict';

    // AI_Rank: 0-100 scale (or empty)
    // Rank: user ranking 0-3 (or empty)

    // Maximum lengths for validation
    const MAX_GROUP_LENGTH = 50;
    const MAX_NODE_LENGTH = 50;

    /**
     * Validate node data for errors
     * @param {Array} nodes - Array of node objects
     * @returns {Array} Array of error messages
     */
    const validateNodes = function(nodes) {
        const errors = [];
        const warnings = [];
        const ids = new Set();

        // Check for duplicates and validation
        nodes.forEach((node, index) => {
            const rowNum = index + 1;

            // Check for required fields
            if (!node.Group_xA || !node.Node_xA) {
                errors.push(`Row ${rowNum}: Missing Group or Node name`);
            }

            // Check for duplicate IDs (case-sensitive)
            if (node.ID_xA) {
                if (ids.has(node.ID_xA)) {
                    errors.push(`Duplicate ID: ${node.ID_xA}`);
                }
                ids.add(node.ID_xA);
            }

            // Link validation removed - feature deprecated

            // Validate AI_Rank_xB values (must be empty or 0-100)
            if (node.AI_Rank_xB !== '' && node.AI_Rank_xB !== undefined && node.AI_Rank_xB !== null) {
                const aiRankVal = parseInt(node.AI_Rank_xB);
                if (isNaN(aiRankVal) || aiRankVal < 0 || aiRankVal > 100) {
                    errors.push(`Row ${rowNum}: Invalid AI Rank "${node.AI_Rank_xB}" (use: 0-100 or empty)`);
                }
            }

            // Validate Rank_xB values (must be empty or 0-3)
            if (node.Rank_xB !== '' && node.Rank_xB !== undefined && node.Rank_xB !== null) {
                const rankVal = parseInt(node.Rank_xB);
                if (isNaN(rankVal) || rankVal < 0 || rankVal > 3) {
                    errors.push(`Row ${rowNum}: Invalid Rank "${node.Rank_xB}" (use: 0, 1, 2, 3 or empty)`);
                }
            }

            // Check max lengths
            if (node.Group_xA && node.Group_xA.length > MAX_GROUP_LENGTH) {
                warnings.push(`Row ${rowNum}: Group name exceeds ${MAX_GROUP_LENGTH} characters`);
            }
            if (node.Node_xA && node.Node_xA.length > MAX_NODE_LENGTH) {
                warnings.push(`Row ${rowNum}: Node name exceeds ${MAX_NODE_LENGTH} characters`);
            }
        });

        // Return errors first, then warnings
        return [...errors, ...warnings];
    };

    /**
     * Generate unique ID from Group and Node
     * @param {String} group - Group name
     * @param {String} node - Node name
     * @returns {String} Generated ID
     */
    const generateID = function(group, node) {
        if (!group || !node) return '';
        return `${group}-${node}`;
    };

    /**
     * Generate unique group name with _N suffix
     * @param {String} baseName - Base group name to duplicate
     * @param {Array} nodes - Array of node objects
     * @returns {String} Unique group name with suffix
     */
    const generateUniqueGroupName = function(baseName, nodes) {
        // Extract existing group names
        const existingGroups = new Set(nodes.map(n => n.Group_xA));

        // Pattern to match baseName_N format
        const escapedBase = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`^${escapedBase}_(\\d+)$`);

        let maxSuffix = 0;

        // Check if base name itself exists (without suffix)
        if (existingGroups.has(baseName)) {
            maxSuffix = 1;
        }

        // Find highest suffix number
        existingGroups.forEach(groupName => {
            const match = groupName.match(pattern);
            if (match) {
                const suffix = parseInt(match[1]);
                maxSuffix = Math.max(maxSuffix, suffix);
            }
        });

        // Return next available suffix
        return `${baseName}_${maxSuffix + 1}`;
    };

    /**
     * Parse Mermaid file content to node data
     * @param {String} mermaidContent - Mermaid .mmd file content
     * @returns {Array} Array of node objects
     */
    const parseMermaidToNodes = function(mermaidContent) {
        const nodes = [];
        const nodeMap = new Map(); // Map of nodeId -> {Group, Node, ID}
        const links = [];

        const lines = mermaidContent.split('\n');

        lines.forEach(line => {
            line = line.trim();

            // Skip comments and graph declaration
            if (line.startsWith('%%') || line.startsWith('graph') || line === '') {
                return;
            }

            // Parse node definition: nodeId["Label"] or nodeId("Label")
            const nodeMatch = line.match(/(\w+)[\[\(]"([^"]+)"[\]\)]/);
            if (nodeMatch) {
                const nodeId = nodeMatch[1];
                const label = nodeMatch[2];

                // Try to extract Group-Node from label
                let group = 'Default';
                let node = label;

                if (label.includes('-')) {
                    const parts = label.split('-');
                    group = parts[0].trim();
                    node = parts.slice(1).join('-').trim();
                }

                nodeMap.set(nodeId, { Group: group, Node: node, ID: label });
            }

            // Parse link: nodeA --> nodeB or nodeA -->|label| nodeB
            const linkMatch = line.match(/(\w+)\s*-->\s*(?:\|([^|]+)\|)?\s*(\w+)/);
            if (linkMatch) {
                const fromId = linkMatch[1];
                const label = linkMatch[2] || '';
                const toId = linkMatch[3];

                links.push({ from: fromId, to: toId, label: label.trim() });
            }
        });

        // Convert to node array
        nodeMap.forEach((data, nodeId) => {
            const node = {
                Group_xA: data.Group,
                Node_xA: data.Node,
                ID_xA: data.ID,
                Linked_Node_ID_xA: '',
                Hidden_Node_xB: 0,
                Hidden_Link_xB: 0,
                Link_Label_xB: '',
                Link_Arrow_xB: 'To'
            };

            // Find links from this node
            const outgoingLinks = links.filter(l => l.from === nodeId);
            if (outgoingLinks.length > 0) {
                const link = outgoingLinks[0]; // Take first link
                const targetNode = nodeMap.get(link.to);
                if (targetNode) {
                    node.Linked_Node_ID_xA = targetNode.ID;
                    node.Link_Label_xB = link.label;
                }
            }

            nodes.push(node);
        });

        return nodes;
    };

    /**
     * Generate context summary for AI chat
     * Used to provide token-efficient context for large graphs
     * @param {Array} nodes - Array of node objects
     * @returns {Object} Summary object with totalNodes, totalGroups, groups array
     */
    const generateContextSummary = function(nodes) {
        const groups = {};

        nodes.forEach(node => {
            const groupName = node.Group_xA || 'Ungrouped';
            if (!groups[groupName]) {
                groups[groupName] = { count: 0, nodes: [] };
            }
            groups[groupName].count++;
            groups[groupName].nodes.push(node.Node_xA);
        });

        return {
            totalNodes: nodes.length,
            totalGroups: Object.keys(groups).length,
            groups: Object.entries(groups).map(([name, data]) => ({
                name,
                nodeCount: data.count,
                nodeNames: data.nodes.slice(0, 5), // First 5 nodes only
                hasMore: data.nodes.length > 5
            }))
        };
    };

    // === Root Count Utilities ===

    /**
     * Count non-empty root fields in a node
     * @param {Object} node - Node object with Root1_xB, Root2_xB, Root3_xB fields
     * @returns {Number} Count of populated roots (1, 2, or 3), defaults to 1 if no roots
     */
    const countRoots = function(node) {
        let count = 0;
        if (node.Root1_xB && String(node.Root1_xB).trim()) count++;
        if (node.Root2_xB && String(node.Root2_xB).trim()) count++;
        if (node.Root3_xB && String(node.Root3_xB).trim()) count++;
        return count || 1; // Default to 1 if no roots populated
    };

    /**
     * Get status key from Rank_xB value
     * @param {*} rank - Rank_xB value
     * @returns {String} Status key: 'unranked', 'blocked', 'tier1', 'tier2', 'tier3'
     */
    const getStatusFromRank = function(rank) {
        if (rank === '' || rank === undefined || rank === null) return 'unranked';
        if (rank === 0) return 'blocked';
        if (rank === 1) return 'tier1';
        if (rank === 2) return 'tier2';
        if (rank === 3) return 'tier3';
        return 'unranked';
    };

    // === MUX Node Utilities ===

    /**
     * Check if node name ends with " MUX" (multiplexer/shared resource node)
     * MUX nodes are cloned per destination group to avoid false visual bridges
     * @param {String} nodeName - Node_xA value
     * @returns {Boolean}
     */
    const isMuxNode = function(nodeName) {
        return nodeName && String(nodeName).trim().endsWith(' MUX');
    };

    /**
     * Generate clone ID for MUX node
     * @param {String} originalID - Original node ID (e.g., "Power-24V Feed MUX")
     * @param {String} connectedID - Connected node ID (e.g., "PLC Rack-Input 1")
     * @returns {String} Clone ID (e.g., "Power-24V Feed MUX__mux__PLC Rack-Input 1")
     */
    const generateMuxCloneID = function(originalID, connectedID) {
        return `${originalID}__mux__${connectedID}`;
    };

    /**
     * Parse clone ID to extract original and connected IDs
     * @param {String} cloneID
     * @returns {Object|null} { originalID, connectedID } or null if not a clone
     */
    const parseMuxCloneID = function(cloneID) {
        if (!cloneID) return null;
        const idx = cloneID.indexOf('__mux__');
        if (idx === -1) return null;
        return {
            originalID: cloneID.substring(0, idx),
            connectedID: cloneID.substring(idx + 7)
        };
    };

    // Expose utilities to global namespace
    window.GraphApp.utils = {
        validateNodes,
        generateID,
        generateUniqueGroupName,
        parseMermaidToNodes,
        generateContextSummary,
        countRoots,
        getStatusFromRank,
        isMuxNode,
        generateMuxCloneID,
        parseMuxCloneID,
        // Legacy aliases (deprecated)
        isAuxNode: isMuxNode,
        generateAuxCloneID: generateMuxCloneID,
        parseAuxCloneID: parseMuxCloneID
    };

})(window);
