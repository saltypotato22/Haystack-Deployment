/**
 * Slim Graph - Main Application
 * Network Diagram Visualizer
 * Matching Slim Gantt design system
 */

(function(window) {
    'use strict';

    function SlimGraphApp() {
        const { useState, useMemo, useEffect, useCallback, useRef } = React;

        // Get icons from namespace
        const { Upload, Download, Plus, Trash2, ZoomIn, ZoomOut, Info, AlertCircle, FileText, Image, File, X, Eye, EyeOff, Maximize2, ArrowUp, ArrowDown, ChevronDown, ChevronUp, ChevronRight, RotateCcw, RotateCw, Copy, Sparkles, Send, Settings, LayoutCanvasPriority, LayoutBalanced, LayoutTablePriority, Sun, Moon } = window.GraphApp.Icons;

        // State Management - Start empty (no default demo)
        const [nodes, setNodes] = useState([]);
        const [errors, setErrors] = useState([]);
        const [settings, setSettings] = useState({
            direction: 'TB', // TB, BT, LR, or RL (used by compact layout)
            layout: 'smart', // smart, vertical, horizontal, compact-vertical, compact-horizontal
            zoom: 100,
            showTooltips: true,
            curve: 'basis', // basis (curved), linear (straight), or step (orthogonal)
            curveAmount: 40, // 10-100, perpendicular distance for curve arc (only applies when curve='basis')
            nodeSpacing: 0 // 0-100, extra spacing (5 levels: 0, 25, 50, 75, 100)
        });
        const [showExportModal, setShowExportModal] = useState(false);
        const [dataFormat, setDataFormat] = useState('candidates'); // 'candidates' | 'roots'
        const [selectedTerritories, setSelectedTerritories] = useState(new Set()); // Territory filter for root mode
        const [showBlockedRoots, setShowBlockedRoots] = useState(true); // Show/hide blocked roots (engagement=0)
        const [deleteConfirm, setDeleteConfirm] = useState(null);
        const [hiddenGroups, setHiddenGroups] = useState(new Set());
        const [collapsedGroups, setCollapsedGroups] = useState(new Set());
        const [blockedRoots, setBlockedRoots] = useState(new Set());  // Track independently blocked roots
        const [showReadmeModal, setShowReadmeModal] = useState(false);
        const [showHelpModal, setShowHelpModal] = useState(false);
        const [showDemoMenu, setShowDemoMenu] = useState(false);
        const [compactView, setCompactView] = useState(false);

        // Theme state - read from DOM attribute (set by early detection script)
        const [theme, setTheme] = useState(() => {
            return document.documentElement.getAttribute('data-theme') || 'light';
        });

        const [infoPopup, setInfoPopup] = useState({ open: false, type: null, groupName: null, nodeIndex: null });
        // Info popup position and size (draggable/resizable)
        const [infoPopupPos, setInfoPopupPos] = useState({ x: 150, y: 100 });
        const [infoPopupSize, setInfoPopupSize] = useState({ width: 900, height: 400 });
        const [infoDragging, setInfoDragging] = useState(false);
        const [infoResizing, setInfoResizing] = useState(false);
        const infoDragStart = useRef({ x: 0, y: 0 });
        // Original values for Cancel functionality
        const [infoOriginal, setInfoOriginal] = useState({ groupInfo: '', nodeInfo: '', linkInfo: '', groupName: '', nodeName: '' });
        const [selectedRowIndex, setSelectedRowIndex] = useState(null);
        const [currentFileName, setCurrentFileName] = useState('');

        // AI Generate state
        const [showSettingsModal, setShowSettingsModal] = useState(false);
        const [apiKey, setApiKey] = useState(() => {
            try { return localStorage.getItem('anthropic_api_key') || ''; }
            catch { return ''; }
        });
        const [aiModel, setAiModel] = useState(() => {
            try { return localStorage.getItem('anthropic_model') || 'claude-sonnet-4-5-20250929'; }
            catch { return 'claude-sonnet-4-5-20250929'; }
        });
        const [showAIModal, setShowAIModal] = useState(false);
        const [aiPrompt, setAiPrompt] = useState('');
        const [aiLoading, setAiLoading] = useState(false);
        const [aiError, setAiError] = useState('');
        const [aiConversation, setAiConversation] = useState([]);
        // Format: [{ role: 'user'|'assistant', content: string, type: 'message'|'delta'|'full', timestamp: Date }]

        // AI Modal position and size (draggable/resizable)
        const [aiModalPos, setAiModalPos] = useState({ x: 100, y: 50 });
        const [aiModalSize, setAiModalSize] = useState({ width: 400, height: 500 });
        const [aiDragging, setAiDragging] = useState(false);
        const [aiResizing, setAiResizing] = useState(false);
        const aiDragStart = useRef({ x: 0, y: 0 });

        // AI Skill state (custom or default system prompt)
        const [currentSkill, setCurrentSkill] = useState({ content: '', isCustom: false, name: 'Default' });
        const [skillLoading, setSkillLoading] = useState(true);

        // Context menu state (right-click on group/node/edge in canvas)
        const [contextMenu, setContextMenu] = useState({
            open: false,
            type: null,        // 'group' | 'node' | 'edge'
            groupName: null,   // For groups
            nodeId: null,      // For nodes
            edgeData: null,    // For edges: { edgeId, sourceId, targetId }
            position: { x: 0, y: 0 }
        });

        // ========== GRID-FIRST MODE STATE (v3.0) ==========
        const [gridSize, setGridSize] = useState(3);              // 2-8
        const [currentPage, setCurrentPage] = useState(0);        // 0-indexed
        const [gridFilters, setGridFilters] = useState({
            rankFilter: 'all',        // 'all' | 'unranked' | 'ranked' | 'blocked'
            groupFilter: [],          // [] = all groups, ['A','B'] = only A and B
            aiScoreRange: [0, 100],   // [min, max]
            sortBy: 'ai-desc',        // 'ai-desc' | 'ai-asc' | 'alpha-asc' | 'alpha-desc' | 'random'
            searchText: ''            // Filter by name contains
        });

        // Filter matrix state (Status × Root Count) - separate for clarity
        // Status rows use { r1: bool, r2: bool, r3: bool } for granular filtering
        // Layer rows (rootblocked) use string mode: 'show' | 'only' | 'hide'
        const [filterMatrix, setFilterMatrix] = useState({
            unranked:    { r1: true, r2: true, r3: true },
            blocked:     { r1: true, r2: true, r3: true },
            tier1:       { r1: true, r2: true, r3: true },
            tier2:       { r1: true, r2: true, r3: true },
            tier3:       { r1: true, r2: true, r3: true },
            rootblocked: 'show'  // 'show' = include blocked, 'only' = only blocked, 'hide' = exclude blocked
        });
        const [isEvalSession, setIsEvalSession] = useState(false); // Guided mode (locks filters)

        // Grid eval wave state
        const [gridEvalBatch, setGridEvalBatch] = useState([]); // Current wave of candidates
        const [gridEvalExitingIds, setGridEvalExitingIds] = useState(new Set()); // IDs being animated out
        const [gridEvalAllDone, setGridEvalAllDone] = useState(false); // Show "All Done!" message
        const [gridEvalRatedCount, setGridEvalRatedCount] = useState(0); // Count of rated in session

        // Refs
        const gridEvalGridRef = useRef(null);  // Grid cell tracking
        const gridEvalBatchRef = useRef([]);  // Current batch ref (avoid stale closures)
        const gridFiltersRef = useRef(gridFilters);  // Filters ref (avoid stale closures)
        const fileInputRef = useRef(null);
        const skillInputRef = useRef(null);

        // History Manager for undo/redo
        const historyRef = useRef(new window.GraphApp.SnapshotHistory(50));
        const [canUndo, setCanUndo] = useState(false);
        const [canRedo, setCanRedo] = useState(false);

        // Controlled commit pattern for Group/Node inputs - prevents live merge bug
        // Shape: { index: number, field: 'Group_xA' | 'Node_xA', value: string, originalValue: string }
        const [editingCell, setEditingCell] = useState(null);

        // Track if Info popup content was edited (for undo history)
        const infoEditedRef = useRef(false);

        // Ref for current nodes (for Escape handler to access latest state)
        const nodesRef = useRef(nodes);

        // Keep refs in sync with state
        useEffect(() => {
            nodesRef.current = nodes;
        }, [nodes]);

        // Keep grid eval refs in sync
        useEffect(() => {
            gridEvalBatchRef.current = gridEvalBatch;
        }, [gridEvalBatch]);

        useEffect(() => {
            gridFiltersRef.current = gridFilters;
        }, [gridFilters]);

        // Load AI skill on mount (custom from localStorage, or default from file)
        useEffect(() => {
            async function loadSkill() {
                setSkillLoading(true);
                try {
                    const skill = await window.GraphApp.core.skillLoader.getCurrentSkill();
                    setCurrentSkill(skill);
                } catch (e) {
                    console.error('Error loading skill:', e);
                } finally {
                    setSkillLoading(false);
                }
            }
            loadSkill();
        }, []);

        // Close demo menu when clicking outside
        useEffect(() => {
            if (!showDemoMenu) return;
            const handleClick = (e) => {
                if (!e.target.closest('[data-demos-dropdown]')) {
                    setShowDemoMenu(false);
                }
            };
            document.addEventListener('click', handleClick);
            return () => document.removeEventListener('click', handleClick);
        }, [showDemoMenu]);

        // Connect window callback for group right-click (from Cytoscape) - opens info popup directly
        useEffect(() => {
            window.onGroupContextMenu = (data) => {
                // Find the node index for this group
                const nodeIndex = nodes.findIndex(n => n.Group_xA === data.groupName);
                if (nodeIndex >= 0) {
                    // Store original values for Cancel
                    setInfoOriginal({
                        groupInfo: nodes[nodeIndex].Group_Info || '',
                        nodeInfo: '',
                        linkInfo: '',
                        groupName: data.groupName,
                        nodeName: ''
                    });
                    // Set popup size and center in viewport
                    const newWidth = 800, newHeight = 400;
                    setInfoPopupSize({ width: newWidth, height: newHeight });
                    setInfoPopupPos({
                        x: Math.max(50, (window.innerWidth - newWidth) / 2),
                        y: Math.max(50, (window.innerHeight - newHeight) / 2)
                    });
                    setInfoPopup({ open: true, type: 'group', groupName: data.groupName, nodeIndex });
                }
            };
            return () => { window.onGroupContextMenu = null; };
        }, [nodes]);

        // Connect window callback for node right-click (from Cytoscape) - opens info popup directly
        useEffect(() => {
            window.onNodeContextMenu = (data) => {
                const nodeIndex = nodes.findIndex(n => n.ID_xA === data.nodeId);
                if (nodeIndex >= 0) {
                    const node = nodes[nodeIndex];
                    // Store original values for Cancel
                    setInfoOriginal({
                        groupInfo: node.Group_Info || '',
                        nodeInfo: node.Node_Info || '',
                        linkInfo: node.Link_Info || '',
                        groupName: node.Group_xA || '',
                        nodeName: node.Node_xA || ''
                    });
                    // Set popup size and center in viewport (smaller for single panel)
                    const newWidth = 500, newHeight = 350;
                    setInfoPopupSize({ width: newWidth, height: newHeight });
                    setInfoPopupPos({
                        x: Math.max(50, (window.innerWidth - newWidth) / 2),
                        y: Math.max(50, (window.innerHeight - newHeight) / 2)
                    });
                    setInfoPopup({ open: true, type: 'node', groupName: node.Group_xA, nodeIndex });
                }
            };
            return () => { window.onNodeContextMenu = null; };
        }, [nodes]);

        // Connect window callback for edge right-click (from Cytoscape) - opens info popup directly
        useEffect(() => {
            window.onEdgeContextMenu = (data) => {
                // Find the source node (the one with the link)
                const nodeIndex = nodes.findIndex(n =>
                    n.ID_xA === data.sourceId && n.Linked_Node_ID_xA === data.targetId
                );
                if (nodeIndex >= 0) {
                    const node = nodes[nodeIndex];
                    // Store original values for Cancel
                    setInfoOriginal({
                        groupInfo: node.Group_Info || '',
                        nodeInfo: node.Node_Info || '',
                        linkInfo: node.Link_Info || '',
                        groupName: node.Group_xA || '',
                        nodeName: node.Node_xA || ''
                    });
                    // Set popup size and center in viewport (smaller for single panel)
                    const newWidth = 500, newHeight = 350;
                    setInfoPopupSize({ width: newWidth, height: newHeight });
                    setInfoPopupPos({
                        x: Math.max(50, (window.innerWidth - newWidth) / 2),
                        y: Math.max(50, (window.innerHeight - newHeight) / 2)
                    });
                    setInfoPopup({ open: true, type: 'edge', groupName: node.Group_xA, nodeIndex });
                }
            };
            return () => { window.onEdgeContextMenu = null; };
        }, [nodes]);

        // Prevent browser's native context menu on canvas (multiple layers of prevention)
        useEffect(() => {
            // Handler for document level
            const preventContextMenu = (e) => {
                const container = document.getElementById('mermaid-container');
                const isCanvas = e.target.tagName === 'CANVAS';
                const isInContainer = container && container.contains(e.target);
                if (isCanvas || isInContainer) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }
            };

            // Add to multiple targets for maximum coverage
            document.addEventListener('contextmenu', preventContextMenu, true);
            document.body.addEventListener('contextmenu', preventContextMenu, true);
            window.addEventListener('contextmenu', preventContextMenu, true);

            return () => {
                document.removeEventListener('contextmenu', preventContextMenu, true);
                document.body.removeEventListener('contextmenu', preventContextMenu, true);
                window.removeEventListener('contextmenu', preventContextMenu, true);
            };
        }, []);

        // Close context menu when clicking outside
        useEffect(() => {
            if (!contextMenu.open) return;
            const handleClick = () => setContextMenu({ open: false, type: null, groupName: null, nodeId: null, edgeData: null, position: { x: 0, y: 0 } });
            // Use setTimeout to avoid closing immediately on the same click that opened it
            const timeout = setTimeout(() => {
                document.addEventListener('click', handleClick);
            }, 0);
            return () => {
                clearTimeout(timeout);
                document.removeEventListener('click', handleClick);
            };
        }, [contextMenu.open]);

        // PERFORMANCE: O(1) lookup map for node IDs - used by multiple computations
        const nodeIdMap = useMemo(() => {
            const map = new Map();
            nodes.forEach((node, index) => {
                if (node.ID_xA) map.set(node.ID_xA, index);
            });
            return map;
        }, [nodes]);

        // PERFORMANCE: Pre-compute first index of each group for table filtering
        const groupFirstIndex = useMemo(() => {
            const map = new Map();
            nodes.forEach((node, index) => {
                if (!map.has(node.Group_xA)) {
                    map.set(node.Group_xA, index);
                }
            });
            return map;
        }, [nodes]);

        // Detect groups where Group_Info has inconsistent values
        const groupInfoInconsistencies = useMemo(() => {
            const issues = new Set(); // Set of groupNames with inconsistent Group_Info
            const groupValues = {};
            nodes.forEach(node => {
                const group = node.Group_xA;
                if (!group) return;
                if (!groupValues[group]) groupValues[group] = new Set();
                groupValues[group].add(node.Group_Info || '');
            });
            Object.entries(groupValues).forEach(([group, values]) => {
                if (values.size > 1) {
                    issues.add(group);
                }
            });
            return issues;
        }, [nodes]);

        // Calculate which groups have external references - O(n) with nodeIdMap
        const groupsWithExternalRefs = useMemo(() => {
            const groups = new Set();
            nodes.forEach(sourceNode => {
                if (sourceNode.Linked_Node_ID_xA && !sourceNode.Hidden_Link_xB) {
                    // O(1) lookup instead of O(n) find()
                    const targetIndex = nodeIdMap.get(sourceNode.Linked_Node_ID_xA);
                    if (targetIndex !== undefined) {
                        const targetNode = nodes[targetIndex];
                        if (targetNode.Group_xA !== sourceNode.Group_xA) {
                            groups.add(targetNode.Group_xA);
                        }
                    }
                }
            });
            return groups;
        }, [nodes, nodeIdMap]);

        // Map errors to row indices for highlighting - O(n) with nodeIdMap
        const errorRowMap = useMemo(() => {
            const map = {};

            errors.forEach(errorMsg => {
                // Parse "Row X: ..." errors
                const rowMatch = errorMsg.match(/Row (\d+)/);
                if (rowMatch) {
                    const rowIndex = parseInt(rowMatch[1]) - 1; // Convert to 0-based index
                    if (!map[rowIndex]) map[rowIndex] = [];
                    map[rowIndex].push(errorMsg);
                }

                // Handle "Duplicate ID: ..." errors - O(1) lookup instead of O(n) loop
                const dupMatch = errorMsg.match(/Duplicate ID: (.+)/);
                if (dupMatch) {
                    const dupID = dupMatch[1];
                    // Use nodeIdMap for O(1) lookup of first occurrence
                    const idx = nodeIdMap.get(dupID);
                    if (idx !== undefined) {
                        if (!map[idx]) map[idx] = [];
                        if (!map[idx].includes(errorMsg)) {
                            map[idx].push(errorMsg);
                        }
                    }
                    // Also find duplicates by scanning once (they share the same ID)
                    nodes.forEach((node, nodeIdx) => {
                        if (node.ID_xA === dupID && nodeIdx !== idx) {
                            if (!map[nodeIdx]) map[nodeIdx] = [];
                            if (!map[nodeIdx].includes(errorMsg)) {
                                map[nodeIdx].push(errorMsg);
                            }
                        }
                    });
                }
            });

            return map;
        }, [errors, nodes, nodeIdMap]);

        // Aggregate errors by group name - for collapsed group error indication
        const groupErrorMap = useMemo(() => {
            const map = {};
            nodes.forEach((node, index) => {
                if (!node.Group_xA) return;
                if (!map[node.Group_xA]) {
                    map[node.Group_xA] = { count: 0, errors: [] };
                }
                const rowErrors = errorRowMap[index];
                if (rowErrors && rowErrors.length > 0) {
                    map[node.Group_xA].count += rowErrors.length;
                    map[node.Group_xA].errors.push(...rowErrors);
                }
            });
            return map;
        }, [nodes, errorRowMap]);

        // Memoized unique groups for evaluation filter UI
        const uniqueGroups = useMemo(() => {
            return [...new Set(nodes.map(n => n.Group_xA).filter(Boolean))].sort();
        }, [nodes]);

        // Memoized group counts for sidebar display
        const groupCounts = useMemo(() => {
            const counts = {};
            nodes.forEach(node => {
                const group = node.Group_xA;
                if (group) {
                    counts[group] = (counts[group] || 0) + 1;
                }
            });
            return counts;
        }, [nodes]);

        // Memoized rank statistics for permanent stats bar
        const rankStats = useMemo(() => {
            const stats = { total: 0, unranked: 0, blocked: 0, rank1: 0, rank2: 0, rank3: 0 };
            stats.total = nodes.length;
            nodes.forEach(node => {
                const rank = node.Rank_xB;
                if (rank === '' || rank === undefined || rank === null) {
                    stats.unranked++;
                } else if (rank === 0) {
                    stats.blocked++;
                } else if (rank === 1) {
                    stats.rank1++;
                } else if (rank === 2) {
                    stats.rank2++;
                } else if (rank === 3) {
                    stats.rank3++;
                }
            });
            return stats;
        }, [nodes]);

        // Memoized visible columns for filter matrix (which root counts exist in data)
        const visibleColumns = useMemo(() => {
            const countRoots = window.GraphApp.utils.countRoots;
            const counts = new Set();
            nodes.forEach(node => counts.add(countRoots(node)));
            return ['r1', 'r2', 'r3'].filter(col => counts.has(parseInt(col[1])));
        }, [nodes]);

        // Memoized matrix counts (candidates per status × root count cell)
        const matrixCounts = useMemo(() => {
            const countRoots = window.GraphApp.utils.countRoots;
            const getStatusFromRank = window.GraphApp.utils.getStatusFromRank;
            const counts = {
                unranked:    { r1: 0, r2: 0, r3: 0 },
                blocked:     { r1: 0, r2: 0, r3: 0 },
                tier1:       { r1: 0, r2: 0, r3: 0 },
                tier2:       { r1: 0, r2: 0, r3: 0 },
                tier3:       { r1: 0, r2: 0, r3: 0 },
                rootblocked: { r1: 0, r2: 0, r3: 0 }
            };
            nodes.forEach(node => {
                const status = getStatusFromRank(node.Rank_xB);
                const rootCount = countRoots(node);
                const colKey = 'r' + rootCount;
                if (counts[status] && counts[status][colKey] !== undefined) {
                    counts[status][colKey]++;
                }
                // Also count root-blocked candidates
                const isRootBlocked = blockedRoots.size > 0 && (
                    blockedRoots.has(node.Root1_xB) ||
                    blockedRoots.has(node.Root2_xB) ||
                    blockedRoots.has(node.Root3_xB)
                );
                if (isRootBlocked && counts.rootblocked[colKey] !== undefined) {
                    counts.rootblocked[colKey]++;
                }
            });
            return counts;
        }, [nodes, blockedRoots]);

        // Initialize app on mount (starts empty - no default demo)
        useEffect(() => {
            setNodes([]);
            setCurrentFileName('');
            setCollapsedGroups(new Set());
            setErrors([]);

            // Initialize empty history
            historyRef.current.push([]);
            setCanUndo(historyRef.current.canUndo());
            setCanRedo(historyRef.current.canRedo());
        }, []);

        // Helper to save nodes to history
        const saveToHistory = useCallback((newNodes) => {
            historyRef.current.push(newNodes);
            setCanUndo(historyRef.current.canUndo());
            setCanRedo(historyRef.current.canRedo());
        }, []);

        // Helper: Find group boundaries (first and last index of a group in nodes array)
        const getGroupBounds = useCallback((groupName) => {
            let start = -1, end = -1;
            nodes.forEach((node, i) => {
                if (node.Group_xA === groupName) {
                    if (start === -1) start = i;
                    end = i;
                }
            });
            return { start, end };
        }, [nodes]);

        // Helper: Find all groups that share links with a given group (bidirectional)
        const getLinkedGroups = useCallback((groupName) => {
            const linkedGroups = new Set();

            // Get all nodes in this group
            const nodesInGroup = nodes.filter(n => n.Group_xA === groupName);
            const nodeIDsInGroup = new Set(nodesInGroup.map(n => n.ID_xA));

            // Find outgoing links (from this group to others)
            nodesInGroup.forEach(node => {
                if (node.Linked_Node_ID_xA) {
                    const targetIndex = nodeIdMap.get(node.Linked_Node_ID_xA);
                    if (targetIndex !== undefined) {
                        const targetNode = nodes[targetIndex];
                        if (targetNode.Group_xA !== groupName) {
                            linkedGroups.add(targetNode.Group_xA);
                        }
                    }
                }
            });

            // Find incoming links (from others to this group)
            nodes.forEach(node => {
                if (node.Linked_Node_ID_xA && nodeIDsInGroup.has(node.Linked_Node_ID_xA)) {
                    if (node.Group_xA !== groupName) {
                        linkedGroups.add(node.Group_xA);
                    }
                }
            });

            return linkedGroups;
        }, [nodes, nodeIdMap]);

        // Context menu action: Show linked groups (unhide them, keep others as-is)
        const showLinkedGroups = useCallback((groupName) => {
            const linked = getLinkedGroups(groupName);
            setHiddenGroups(prev => {
                const newHidden = new Set(prev);
                newHidden.delete(groupName);  // Unhide clicked group
                linked.forEach(g => newHidden.delete(g));  // Unhide linked
                return newHidden;
            });
            setContextMenu({ open: false, type: null, groupName: null, nodeId: null, edgeData: null, position: { x: 0, y: 0 } });
        }, [getLinkedGroups]);

        // Context menu action: Show ONLY linked groups (hide all others)
        const showOnlyLinkedGroups = useCallback((groupName) => {
            const linked = getLinkedGroups(groupName);
            const allGroups = new Set(nodes.map(n => n.Group_xA).filter(Boolean));

            const newHidden = new Set();
            allGroups.forEach(g => {
                if (g !== groupName && !linked.has(g)) {
                    newHidden.add(g);
                }
            });

            setHiddenGroups(newHidden);
            setContextMenu({ open: false, type: null, groupName: null, nodeId: null, edgeData: null, position: { x: 0, y: 0 } });
        }, [getLinkedGroups, nodes]);

        // Info popup action: Show linked groups (unhide them, keep popup open)
        const showLinkedGroupsFromPopup = useCallback((groupName) => {
            const linked = getLinkedGroups(groupName);
            setHiddenGroups(prev => {
                const newHidden = new Set(prev);
                newHidden.delete(groupName);  // Unhide clicked group
                linked.forEach(g => newHidden.delete(g));  // Unhide linked
                return newHidden;
            });
            // Popup stays open - no setInfoPopup({ open: false })
        }, [getLinkedGroups]);

        // Info popup action: Show ONLY linked groups (hide all others, keep popup open)
        const showOnlyLinkedGroupsFromPopup = useCallback((groupName) => {
            const linked = getLinkedGroups(groupName);
            const allGroups = new Set(nodes.map(n => n.Group_xA).filter(Boolean));

            const newHidden = new Set();
            allGroups.forEach(g => {
                if (g !== groupName && !linked.has(g)) {
                    newHidden.add(g);
                }
            });

            setHiddenGroups(newHidden);
            // Popup stays open - no setInfoPopup({ open: false })
        }, [getLinkedGroups, nodes]);

        // Context menu action: Show group info popup
        const showGroupInfoFromContext = useCallback((groupName) => {
            const nodeIndex = nodes.findIndex(n => n.Group_xA === groupName);
            if (nodeIndex >= 0) {
                // Store original values for Cancel
                setInfoOriginal({
                    groupInfo: nodes[nodeIndex].Group_Info || '',
                    nodeInfo: '',
                    linkInfo: ''
                });
                // Set popup size and center in viewport
                const newWidth = 800, newHeight = 400;
                setInfoPopupSize({ width: newWidth, height: newHeight });
                setInfoPopupPos({
                    x: Math.max(50, (window.innerWidth - newWidth) / 2),
                    y: Math.max(50, (window.innerHeight - newHeight) / 2)
                });
                setInfoPopup({ open: true, type: 'group', groupName, nodeIndex });
            }
            setContextMenu({ open: false, type: null, groupName: null, nodeId: null, edgeData: null, position: { x: 0, y: 0 } });
        }, [nodes]);

        // Context menu action: Show node info popup (single panel)
        const showNodeInfoFromContext = useCallback((nodeId) => {
            const nodeIndex = nodes.findIndex(n => n.ID_xA === nodeId);
            if (nodeIndex >= 0) {
                const node = nodes[nodeIndex];
                // Store original values for Cancel
                setInfoOriginal({
                    groupInfo: node.Group_Info || '',
                    nodeInfo: node.Node_Info || '',
                    linkInfo: node.Link_Info || ''
                });
                // Set popup size and center in viewport (smaller for single panel)
                const newWidth = 500, newHeight = 350;
                setInfoPopupSize({ width: newWidth, height: newHeight });
                setInfoPopupPos({
                    x: Math.max(50, (window.innerWidth - newWidth) / 2),
                    y: Math.max(50, (window.innerHeight - newHeight) / 2)
                });
                setInfoPopup({ open: true, type: 'node', groupName: node.Group_xA, nodeIndex });
            }
            setContextMenu({ open: false, type: null, groupName: null, nodeId: null, edgeData: null, position: { x: 0, y: 0 } });
        }, [nodes]);

        // Context menu action: Show edge info popup (single panel)
        const showEdgeInfoFromContext = useCallback((sourceId, targetId) => {
            // Find the source node (the one with the link)
            const nodeIndex = nodes.findIndex(n =>
                n.ID_xA === sourceId && n.Linked_Node_ID_xA === targetId
            );
            if (nodeIndex >= 0) {
                const node = nodes[nodeIndex];
                // Store original values for Cancel
                setInfoOriginal({
                    groupInfo: node.Group_Info || '',
                    nodeInfo: node.Node_Info || '',
                    linkInfo: node.Link_Info || ''
                });
                // Set popup size and center in viewport (smaller for single panel)
                const newWidth = 500, newHeight = 350;
                setInfoPopupSize({ width: newWidth, height: newHeight });
                setInfoPopupPos({
                    x: Math.max(50, (window.innerWidth - newWidth) / 2),
                    y: Math.max(50, (window.innerHeight - newHeight) / 2)
                });
                setInfoPopup({ open: true, type: 'edge', groupName: node.Group_xA, nodeIndex });
            }
            setContextMenu({ open: false, type: null, groupName: null, nodeId: null, edgeData: null, position: { x: 0, y: 0 } });
        }, [nodes]);

        // Move row up handler
        const handleMoveUp = useCallback(() => {
            if (selectedRowIndex === null || selectedRowIndex <= 0) return;

            const currentNode = nodes[selectedRowIndex];
            const isCollapsed = collapsedGroups.has(currentNode.Group_xA);

            if (isCollapsed) {
                // Move entire group up
                const groupName = currentNode.Group_xA;
                const { start, end } = getGroupBounds(groupName);
                if (start === 0) return; // Already at top

                // Find previous group's start
                const prevGroupName = nodes[start - 1].Group_xA;
                const prevBounds = getGroupBounds(prevGroupName);

                // Swap group blocks
                const newNodes = [...nodes];
                const currentGroup = newNodes.splice(start, end - start + 1);
                newNodes.splice(prevBounds.start, 0, ...currentGroup);

                setNodes(newNodes);
                // Re-validate so error highlights follow moved rows
                const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
                setErrors(validationErrors);
                saveToHistory(newNodes);
                setSelectedRowIndex(prevBounds.start); // Update selection to new position
            } else {
                // Move single node within group
                const { start } = getGroupBounds(currentNode.Group_xA);
                if (selectedRowIndex === start) return; // At top of group

                const newNodes = [...nodes];
                [newNodes[selectedRowIndex - 1], newNodes[selectedRowIndex]] =
                    [newNodes[selectedRowIndex], newNodes[selectedRowIndex - 1]];

                setNodes(newNodes);
                // Re-validate so error highlights follow moved rows
                const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
                setErrors(validationErrors);
                saveToHistory(newNodes);
                setSelectedRowIndex(selectedRowIndex - 1);
            }
        }, [selectedRowIndex, nodes, collapsedGroups, getGroupBounds, saveToHistory]);

        // Move row down handler
        const handleMoveDown = useCallback(() => {
            if (selectedRowIndex === null || selectedRowIndex >= nodes.length - 1) return;

            const currentNode = nodes[selectedRowIndex];
            const isCollapsed = collapsedGroups.has(currentNode.Group_xA);

            if (isCollapsed) {
                // Move entire group down
                const groupName = currentNode.Group_xA;
                const { start, end } = getGroupBounds(groupName);
                if (end === nodes.length - 1) return; // Already at bottom

                // Find next group's end
                const nextGroupName = nodes[end + 1].Group_xA;
                const nextBounds = getGroupBounds(nextGroupName);

                // Swap group blocks
                const newNodes = [...nodes];
                const nextGroup = newNodes.splice(nextBounds.start, nextBounds.end - nextBounds.start + 1);
                newNodes.splice(start, 0, ...nextGroup);

                setNodes(newNodes);
                // Re-validate so error highlights follow moved rows
                const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
                setErrors(validationErrors);
                saveToHistory(newNodes);
                setSelectedRowIndex(start + nextGroup.length); // Update selection
            } else {
                // Move single node within group
                const { end } = getGroupBounds(currentNode.Group_xA);
                if (selectedRowIndex === end) return; // At bottom of group

                const newNodes = [...nodes];
                [newNodes[selectedRowIndex], newNodes[selectedRowIndex + 1]] =
                    [newNodes[selectedRowIndex + 1], newNodes[selectedRowIndex]];

                setNodes(newNodes);
                // Re-validate so error highlights follow moved rows
                const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
                setErrors(validationErrors);
                saveToHistory(newNodes);
                setSelectedRowIndex(selectedRowIndex + 1);
            }
        }, [selectedRowIndex, nodes, collapsedGroups, getGroupBounds, saveToHistory]);

        // Compute disabled states for move buttons
        const canMoveUp = useMemo(() => {
            if (selectedRowIndex === null || selectedRowIndex <= 0) return false;
            const currentNode = nodes[selectedRowIndex];
            if (!currentNode) return false;
            const isCollapsed = collapsedGroups.has(currentNode.Group_xA);

            if (isCollapsed) {
                const { start } = getGroupBounds(currentNode.Group_xA);
                return start > 0;
            } else {
                const { start } = getGroupBounds(currentNode.Group_xA);
                return selectedRowIndex > start;
            }
        }, [selectedRowIndex, nodes, collapsedGroups, getGroupBounds]);

        const canMoveDown = useMemo(() => {
            if (selectedRowIndex === null || selectedRowIndex >= nodes.length - 1) return false;
            const currentNode = nodes[selectedRowIndex];
            if (!currentNode) return false;
            const isCollapsed = collapsedGroups.has(currentNode.Group_xA);

            if (isCollapsed) {
                const { end } = getGroupBounds(currentNode.Group_xA);
                return end < nodes.length - 1;
            } else {
                const { end } = getGroupBounds(currentNode.Group_xA);
                return selectedRowIndex < end;
            }
        }, [selectedRowIndex, nodes, collapsedGroups, getGroupBounds]);

        // Undo function
        const handleUndo = useCallback(() => {
            const previousState = historyRef.current.undo();
            if (previousState) {
                setNodes(previousState);
                setCanUndo(historyRef.current.canUndo());
                setCanRedo(historyRef.current.canRedo());

                // Re-validate
                const validationErrors = window.GraphApp.utils.validateNodes(previousState);
                setErrors(validationErrors);
            }
        }, []);

        // Redo function
        const handleRedo = useCallback(() => {
            const nextState = historyRef.current.redo();
            if (nextState) {
                setNodes(nextState);
                setCanUndo(historyRef.current.canUndo());
                setCanRedo(historyRef.current.canRedo());

                // Re-validate
                const validationErrors = window.GraphApp.utils.validateNodes(nextState);
                setErrors(validationErrors);
            }
        }, []);

        // Keyboard shortcuts for undo/redo
        useEffect(() => {
            const handleKeyDown = (e) => {
                // Ctrl+Z or Cmd+Z for undo
                if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    handleUndo();
                }
                // Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y for redo
                if (((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) ||
                    ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
                    e.preventDefault();
                    handleRedo();
                }
            };

            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }, [handleUndo, handleRedo]);

        // Escape key handler for modals
        useEffect(() => {
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    // Save info popup edits to history before closing
                    if (infoEditedRef.current) {
                        saveToHistory(nodesRef.current);
                        infoEditedRef.current = false;
                    }
                    setShowExportModal(false);
                    setDeleteConfirm(null);
                    setShowHelpModal(false);
                    setShowReadmeModal(false);
                    setShowAIModal(false);
                    setAiError('');
                    setInfoPopup({ open: false, type: null, groupName: null, nodeIndex: null });
                    setContextMenu({ open: false, type: null, groupName: null, nodeId: null, edgeData: null, position: { x: 0, y: 0 } });
                    setShowSettingsModal(false);
                    setShowDemoMenu(false);
                }
            };

            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }, [saveToHistory]);

        // File upload handler
        const handleFileUpload = useCallback(async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            const fileExt = file.name.split('.').pop().toLowerCase();

            try {
                let importedNodes = [];

                if (fileExt === 'xlsx' || fileExt === 'xls') {
                    importedNodes = await window.GraphApp.core.importExcel(file);
                } else if (fileExt === 'csv' || fileExt === 'txt') {
                    const result = await window.GraphApp.exports.importCSV(file);
                    importedNodes = result.nodes || result;  // Handle new { nodes, format } or legacy array
                    if (result.format) {
                        setDataFormat(result.format);
                        // Initialize territory filter with all territories selected
                        if (result.format === 'roots') {
                            const allTerritories = new Set(importedNodes.map(n => n.Group_xA).filter(Boolean));
                            setSelectedTerritories(allTerritories);
                        }
                    }
                    // Merge imported blocked roots with existing (replace existing on import)
                    if (result.blockedRoots && result.blockedRoots.size > 0) {
                        setBlockedRoots(result.blockedRoots);
                    } else {
                        setBlockedRoots(new Set());  // Clear blocked roots if none in import
                    }
                } else if (fileExt === 'mmd') {
                    importedNodes = await window.GraphApp.exports.importMermaid(file);
                } else {
                    alert('Unsupported file format. Please use .xlsx, .csv, or .mmd files.');
                    return;
                }

                setNodes(importedNodes);
                setErrors([]);
                setCurrentFileName(file.name);

                // Validate imported data
                const validationErrors = window.GraphApp.utils.validateNodes(importedNodes);
                if (validationErrors.length > 0) {
                    setErrors(validationErrors);
                }

                // Reset file input
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            } catch (error) {
                alert('Error importing file: ' + error.message);
                console.error(error);
            }
        }, []);

        // Add new node (format-aware defaults)
        const handleAddNode = useCallback(() => {
            const isRoots = dataFormat === 'roots';
            let groupName;
            let nodeName;

            if (isRoots) {
                // Root mode: use selected class or create NEW CLASS
                const selectedArray = Array.from(selectedTerritories).sort();
                if (selectedArray.length > 0) {
                    // Use first selected class alphabetically
                    groupName = selectedArray[0];
                } else {
                    // No class selected - use or create NEW CLASS
                    groupName = 'NEW CLASS';
                    // Auto-select NEW CLASS so the new root is visible
                    setSelectedTerritories(prev => new Set([...prev, 'NEW CLASS']));
                }
                nodeName = 'new_root';
            } else {
                groupName = 'New Group';
                nodeName = 'New Node';
            }

            const newNode = {
                Group_xA: groupName,
                Node_xA: nodeName,
                ID_xA: groupName + '-' + nodeName,
                Linked_Node_ID_xA: '',
                Hidden_Node_xB: 0,
                Hidden_Link_xB: 0,
                Link_Label_xB: '',
                Link_Arrow_xB: 'To',
                Link_Info: '',
                AI_Rank_xB: '',
                Rank_xB: '',
                Root1_xB: '',
                Class1_xB: '',
                Root2_xB: '',
                Class2_xB: '',
                Root3_xB: '',
                Class3_xB: ''
            };

            const newNodes = [...nodes, newNode];
            setNodes(newNodes);

            // Validate after adding
            const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
            setErrors(validationErrors);

            // Save to history
            saveToHistory(newNodes);
        }, [nodes, dataFormat, selectedTerritories, saveToHistory]);

        // ============================================================================
        // AI CHAT FEATURE - Iterative Graph Editing via Claude API
        // ============================================================================
        // Features:
        // - Chat-style interface with conversation history
        // - Three response types: Full CSV (new graphs), Delta Ops (edits), Messages (Q&A)
        // - Token-efficient context: Full CSV for ≤30 nodes, summary for larger graphs
        // - Draggable/resizable modal window
        // - Delta operations: ADD, DELETE, UPDATE, RENAME_GROUP, CONNECT, DISCONNECT
        // ============================================================================

        // AI System Prompt now loaded from skill-loader.js (default-skill.md or custom upload)
        // See: js/skills/default-skill.md for the default prompt
        // {CONTEXT} placeholder is replaced with current graph state before each API call

        /**
         * Parse AI response into structured format
         * @param {string} text - Raw response from Claude API
         * @returns {Object} Parsed response: { type: 'full'|'delta'|'message', ... }
         *   - type: 'full' → { csv: string, summary: string } - Full graph replacement
         *   - type: 'delta' → { operations: Array, summary: string } - Incremental edits
         *   - type: 'message' → { content: string } - Conversational response
         */
        const parseAIResponse = useCallback((text) => {
            // Try JSON operations first (delta mode)
            const jsonMatch = text.match(/```(?:json)?\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[1]);
                    if (parsed.operations && Array.isArray(parsed.operations)) {
                        return {
                            type: 'delta',
                            operations: parsed.operations,
                            summary: parsed.summary || 'Applied changes'
                        };
                    }
                } catch (e) {
                    // Not valid JSON, fall through to CSV check
                }
            }

            // Try CSV (full replacement mode)
            const csvMatch = text.match(/```(?:csv)?\n([\s\S]*?)\n```/);
            if (csvMatch) {
                return {
                    type: 'full',
                    csv: csvMatch[1].trim(),
                    summary: 'Generated graph'
                };
            }

            // Fallback: look for CSV-like content without code blocks
            const lines = text.split('\n');
            const csvLines = lines.filter(line =>
                line.includes('Group_xA') ||
                (line.includes(',') && !line.startsWith('#') && !line.startsWith('{'))
            );
            if (csvLines.length > 1) {
                return {
                    type: 'full',
                    csv: csvLines.join('\n'),
                    summary: 'Generated graph'
                };
            }

            // No code blocks = conversational message (questions, explanations, etc.)
            return {
                type: 'message',
                content: text.trim()
            };
        }, []);

        /**
         * Apply delta operations to node array (immutably)
         * Supports: ADD, DELETE, UPDATE, RENAME_GROUP, CONNECT, DISCONNECT
         * Automatically maintains referential integrity (updates Linked_Node_ID_xA when IDs change)
         * @param {Array} operations - Array of operation objects
         * @param {Array} currentNodes - Current node array
         * @returns {Object} { nodes: Array, changes: Array<string> } - Updated nodes and change log
         */
        const applyDeltaOperations = useCallback((operations, currentNodes) => {
            let newNodes = currentNodes.map(n => ({ ...n })); // Clone all nodes
            const changes = [];

            operations.forEach(op => {
                switch (op.op) {
                    case 'ADD':
                        if (op.nodes && Array.isArray(op.nodes)) {
                            op.nodes.forEach(node => {
                                const newNode = {
                                    Group_xA: node.Group_xA || '',
                                    Node_xA: node.Node_xA || '',
                                    ID_xA: `${node.Group_xA}-${node.Node_xA}`,
                                    Linked_Node_ID_xA: node.Linked_Node_ID_xA || '',
                                    Link_Label_xB: node.Link_Label_xB || '',
                                    Hidden_Node_xB: 0,
                                    Hidden_Link_xB: 0,
                                    Link_Arrow_xB: 'To',
                                    AI_Rank_xB: node.AI_Rank_xB !== undefined ? node.AI_Rank_xB : '',
                                    Rank_xB: node.Rank_xB !== undefined ? node.Rank_xB : '',
                                    Class1_xB: node.Class1_xB || '',
                                    Class2_xB: node.Class2_xB || '',
                                    Class3_xB: node.Class3_xB || '',
                                    Group_Info: '',
                                    Node_Info: ''
                                };
                                newNodes.push(newNode);
                                changes.push(`Added ${newNode.ID_xA}`);
                            });
                        }
                        break;

                    case 'DELETE':
                        if (op.ids && Array.isArray(op.ids)) {
                            const idsToDelete = new Set(op.ids);
                            const beforeCount = newNodes.length;
                            newNodes = newNodes.filter(n => !idsToDelete.has(n.ID_xA));
                            // Clear references to deleted nodes
                            newNodes.forEach(n => {
                                if (idsToDelete.has(n.Linked_Node_ID_xA)) {
                                    n.Linked_Node_ID_xA = '';
                                }
                            });
                            changes.push(`Deleted ${beforeCount - newNodes.length} node(s)`);
                        }
                        break;

                    case 'UPDATE':
                        if (op.id && op.changes) {
                            const idx = newNodes.findIndex(n => n.ID_xA === op.id);
                            if (idx !== -1) {
                                const oldID = newNodes[idx].ID_xA;
                                // Apply changes
                                Object.keys(op.changes).forEach(key => {
                                    if (key !== 'ID_xA') { // Don't allow direct ID changes
                                        newNodes[idx][key] = op.changes[key];
                                    }
                                });
                                // Regenerate ID if Group or Node changed
                                if (op.changes.Group_xA || op.changes.Node_xA) {
                                    newNodes[idx].ID_xA = `${newNodes[idx].Group_xA}-${newNodes[idx].Node_xA}`;
                                    // Update all references to old ID
                                    if (oldID && newNodes[idx].ID_xA && oldID !== newNodes[idx].ID_xA) {
                                        newNodes.forEach(n => {
                                            if (n.Linked_Node_ID_xA === oldID) {
                                                n.Linked_Node_ID_xA = newNodes[idx].ID_xA;
                                            }
                                        });
                                    }
                                }
                                changes.push(`Updated ${op.id}`);
                            }
                        }
                        break;

                    case 'RENAME_GROUP':
                        if (op.from && op.to) {
                            let renamedCount = 0;
                            newNodes.forEach(n => {
                                if (n.Group_xA === op.from) {
                                    const oldID = n.ID_xA;
                                    n.Group_xA = op.to;
                                    n.ID_xA = `${op.to}-${n.Node_xA}`;
                                    // Update all references to old ID
                                    newNodes.forEach(ref => {
                                        if (ref.Linked_Node_ID_xA === oldID) {
                                            ref.Linked_Node_ID_xA = n.ID_xA;
                                        }
                                    });
                                    renamedCount++;
                                }
                            });
                            changes.push(`Renamed group "${op.from}" to "${op.to}" (${renamedCount} nodes)`);
                        }
                        break;

                    case 'CONNECT':
                        if (op.from && op.to) {
                            const fromIdx = newNodes.findIndex(n => n.ID_xA === op.from);
                            if (fromIdx !== -1) {
                                newNodes[fromIdx].Linked_Node_ID_xA = op.to;
                                if (op.label) {
                                    newNodes[fromIdx].Link_Label_xB = op.label;
                                }
                                changes.push(`Connected ${op.from} → ${op.to}`);
                            }
                        }
                        break;

                    case 'DISCONNECT':
                        if (op.id) {
                            const discIdx = newNodes.findIndex(n => n.ID_xA === op.id);
                            if (discIdx !== -1) {
                                newNodes[discIdx].Linked_Node_ID_xA = '';
                                changes.push(`Disconnected ${op.id}`);
                            }
                        }
                        break;

                    default:
                        console.warn('Unknown delta operation:', op.op);
                }
            });

            return { nodes: newNodes, changes };
        }, []);

        /**
         * Build context string for AI system prompt (token-efficient)
         * - ≤30 nodes: Full CSV with all columns
         * - >30 nodes: Summary with group names, node counts, and sample nodes
         * @param {Array} nodeArray - Current node array
         * @returns {string} Context string to inject into skill's {CONTEXT} placeholder
         */
        const buildContext = useCallback((nodeArray) => {
            if (!nodeArray || nodeArray.length === 0) {
                return 'Empty graph. Ready to create a new diagram.';
            }

            // For small graphs (≤30 nodes), include full CSV with all info fields
            if (nodeArray.length <= 30) {
                const lines = ['Group_xA,Node_xA,ID_xA,Linked_Node_ID_xA,Link_Label_xB,Group_Info,Node_Info,Link_Info'];
                nodeArray.forEach(n => {
                    // Escape commas and quotes in info fields
                    const escapeCSV = (val) => {
                        if (!val) return '';
                        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                            return `"${val.replace(/"/g, '""')}"`;
                        }
                        return val;
                    };
                    lines.push(`${n.Group_xA},${n.Node_xA},${n.ID_xA},${n.Linked_Node_ID_xA || ''},${n.Link_Label_xB || ''},${escapeCSV(n.Group_Info)},${escapeCSV(n.Node_Info)},${escapeCSV(n.Link_Info)}`);
                });
                return `FULL GRAPH (${nodeArray.length} nodes):\n${lines.join('\n')}`;
            }

            // For larger graphs, provide summary with info field counts
            const summary = window.GraphApp.utils.generateContextSummary(nodeArray);
            const groupInfoCount = nodeArray.filter(n => n.Group_Info).length;
            const nodeInfoCount = nodeArray.filter(n => n.Node_Info).length;
            const linkInfoCount = nodeArray.filter(n => n.Link_Info).length;
            let ctx = `GRAPH SUMMARY: ${summary.totalNodes} nodes, ${summary.totalGroups} groups, ${summary.totalLinks} connections\n`;
            ctx += `INFO FIELDS: ${groupInfoCount} group info, ${nodeInfoCount} node info, ${linkInfoCount} link info\n\nGROUPS:\n`;
            summary.groups.forEach(g => {
                const nodeList = g.nodeNames.join(', ') + (g.hasMore ? ', ...' : '');
                ctx += `- ${g.name} (${g.nodeCount} nodes, ${g.linkCount} links): ${nodeList}\n`;
            });
            return ctx;
        }, []);

        /**
         * Main AI chat handler - sends user message to Claude API and processes response
         * Maintains conversation history, handles all response types, updates graph state
         * @async
         */
        const generateFromAI = useCallback(async () => {
            if (!apiKey || !aiPrompt.trim()) return;

            setAiLoading(true);
            setAiError('');

            try {
                // Build messages array with conversation history (last 6 messages for token efficiency)
                const messages = [];
                aiConversation.slice(-6).forEach(msg => {
                    messages.push({ role: msg.role, content: msg.content });
                });
                messages.push({ role: 'user', content: aiPrompt });

                // Inject current graph context into system prompt
                const contextString = buildContext(nodes);
                const systemPrompt = currentSkill.content.replace('{CONTEXT}', contextString);

                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true'
                    },
                    body: JSON.stringify({
                        model: aiModel,
                        max_tokens: 4096,
                        system: systemPrompt,
                        messages: messages
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    if (response.status === 401) {
                        throw new Error('Invalid API key. Check your key in Settings.');
                    } else if (response.status === 429) {
                        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
                    } else {
                        throw new Error(errorData.error?.message || `API error: ${response.status}`);
                    }
                }

                const data = await response.json();
                const responseText = data.content[0].text;
                const parsed = parseAIResponse(responseText);

                let newNodes = nodes; // Default: no change
                let assistantMessage;
                let responseType = parsed.type;

                if (parsed.type === 'full') {
                    // Full CSV replacement
                    const csvParsed = Papa.parse(parsed.csv, { header: true, skipEmptyLines: true });
                    const importedNodes = csvParsed.data
                        .filter(row => row.Group_xA && row.Node_xA)
                        .map(row => ({
                            Group_xA: row.Group_xA || '',
                            Node_xA: row.Node_xA || '',
                            ID_xA: `${row.Group_xA}-${row.Node_xA}`,
                            Linked_Node_ID_xA: row.Linked_Node_ID_xA || '',
                            Link_Label_xB: row.Link_Label_xB || '',
                            Hidden_Node_xB: 0,
                            Hidden_Link_xB: 0,
                            Link_Arrow_xB: 'To'
                        }));

                    if (importedNodes.length === 0) {
                        throw new Error('No valid nodes in generated data. Try a different description.');
                    }

                    newNodes = importedNodes;
                    assistantMessage = `Created ${newNodes.length} nodes in ${new Set(newNodes.map(n => n.Group_xA)).size} groups`;

                    setNodes(newNodes);
                    if (nodes.length === 0) {
                        setCurrentFileName('AI Generated');
                    }

                    // Validate and save to history
                    const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
                    setErrors(validationErrors);
                    saveToHistory(newNodes);

                } else if (parsed.type === 'delta') {
                    // Delta operations
                    const result = applyDeltaOperations(parsed.operations, nodes);
                    newNodes = result.nodes;
                    assistantMessage = result.changes.length > 0
                        ? result.changes.join('; ')
                        : parsed.summary || 'No changes applied';

                    if (result.changes.length > 0) {
                        setNodes(newNodes);

                        // Validate and save to history
                        const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
                        setErrors(validationErrors);
                        saveToHistory(newNodes);
                    }

                } else {
                    // Message type - conversational response, no graph changes
                    assistantMessage = parsed.content;
                    // No setNodes() or saveToHistory() - graph unchanged
                }

                // Update conversation history
                setAiConversation(prev => [
                    ...prev,
                    { role: 'user', content: aiPrompt, timestamp: new Date() },
                    { role: 'assistant', content: assistantMessage, type: responseType, timestamp: new Date() }
                ]);

                // Clear prompt but keep modal open for continued conversation
                setAiPrompt('');

            } catch (err) {
                setAiError(err.message);
            } finally {
                setAiLoading(false);
            }
        }, [apiKey, aiModel, aiPrompt, aiConversation, nodes, currentSkill, buildContext, parseAIResponse, applyDeltaOperations, saveToHistory]);

        // AI Modal drag/resize handlers - allow moving and resizing the chat window
        const handleAiDragStart = useCallback((e) => {
            if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
            setAiDragging(true);
            aiDragStart.current = { x: e.clientX - aiModalPos.x, y: e.clientY - aiModalPos.y };
            e.preventDefault();
        }, [aiModalPos]);

        const handleAiDragMove = useCallback((e) => {
            if (aiDragging) {
                const newX = Math.max(0, Math.min(window.innerWidth - aiModalSize.width, e.clientX - aiDragStart.current.x));
                const newY = Math.max(0, Math.min(window.innerHeight - aiModalSize.height, e.clientY - aiDragStart.current.y));
                setAiModalPos({ x: newX, y: newY });
            }
            if (aiResizing) {
                const newWidth = Math.max(300, Math.min(800, e.clientX - aiModalPos.x));
                const newHeight = Math.max(300, Math.min(700, e.clientY - aiModalPos.y));
                setAiModalSize({ width: newWidth, height: newHeight });
            }
        }, [aiDragging, aiResizing, aiModalPos, aiModalSize]);

        const handleAiDragEnd = useCallback(() => {
            setAiDragging(false);
            setAiResizing(false);
        }, []);

        // Attach global mouse handlers for AI modal drag/resize
        useEffect(() => {
            if (aiDragging || aiResizing) {
                window.addEventListener('mousemove', handleAiDragMove);
                window.addEventListener('mouseup', handleAiDragEnd);
                return () => {
                    window.removeEventListener('mousemove', handleAiDragMove);
                    window.removeEventListener('mouseup', handleAiDragEnd);
                };
            }
        }, [aiDragging, aiResizing, handleAiDragMove, handleAiDragEnd]);

        // Info popup drag/resize handlers
        const handleInfoDragStart = useCallback((e) => {
            if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
            setInfoDragging(true);
            infoDragStart.current = { x: e.clientX - infoPopupPos.x, y: e.clientY - infoPopupPos.y };
            e.preventDefault();
        }, [infoPopupPos]);

        const handleInfoDragMove = useCallback((e) => {
            if (infoDragging) {
                const newX = Math.max(0, Math.min(window.innerWidth - infoPopupSize.width, e.clientX - infoDragStart.current.x));
                const newY = Math.max(0, Math.min(window.innerHeight - infoPopupSize.height, e.clientY - infoDragStart.current.y));
                setInfoPopupPos({ x: newX, y: newY });
            }
            if (infoResizing) {
                const newWidth = Math.max(400, Math.min(1200, e.clientX - infoPopupPos.x));
                const newHeight = Math.max(200, Math.min(600, e.clientY - infoPopupPos.y));
                setInfoPopupSize({ width: newWidth, height: newHeight });
            }
        }, [infoDragging, infoResizing, infoPopupPos, infoPopupSize]);

        const handleInfoDragEnd = useCallback(() => {
            setInfoDragging(false);
            setInfoResizing(false);
        }, []);

        // Attach global mouse handlers for info popup drag/resize
        useEffect(() => {
            if (infoDragging || infoResizing) {
                window.addEventListener('mousemove', handleInfoDragMove);
                window.addEventListener('mouseup', handleInfoDragEnd);
                return () => {
                    window.removeEventListener('mousemove', handleInfoDragMove);
                    window.removeEventListener('mouseup', handleInfoDragEnd);
                };
            }
        }, [infoDragging, infoResizing, handleInfoDragMove, handleInfoDragEnd]);

        // Save API settings to localStorage
        const saveAPISettings = useCallback(() => {
            try {
                if (apiKey) {
                    localStorage.setItem('anthropic_api_key', apiKey);
                } else {
                    localStorage.removeItem('anthropic_api_key');
                }
                localStorage.setItem('anthropic_model', aiModel);
            } catch (e) {
                console.warn('Could not save to localStorage:', e);
            }
            setShowSettingsModal(false);
        }, [apiKey, aiModel]);

        // Clear API key
        const clearAPIKey = useCallback(() => {
            setApiKey('');
            try {
                localStorage.removeItem('anthropic_api_key');
            } catch (e) {
                console.warn('Could not clear localStorage:', e);
            }
        }, []);

        // Upload custom skill file
        const handleSkillUpload = useCallback(async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            try {
                const content = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsText(file);
                });

                // Validate skill content
                const validation = window.GraphApp.core.skillLoader.validateSkill(content);
                if (!validation.valid) {
                    alert('Invalid skill file:\n' + validation.errors.join('\n'));
                    return;
                }

                // Save to localStorage
                window.GraphApp.core.skillLoader.saveCustomSkill(content, file.name);

                // Update state
                setCurrentSkill({
                    content: content,
                    isCustom: true,
                    name: file.name
                });

                // Reset file input
                if (skillInputRef.current) {
                    skillInputRef.current.value = '';
                }

            } catch (error) {
                alert('Error reading skill file: ' + error.message);
                console.error(error);
            }
        }, []);

        // Reset to default skill
        const resetToDefaultSkill = useCallback(async () => {
            window.GraphApp.core.skillLoader.clearCustomSkill();

            try {
                const skill = await window.GraphApp.core.skillLoader.getCurrentSkill();
                setCurrentSkill(skill);
            } catch (e) {
                console.error('Error resetting skill:', e);
            }
        }, []);

        // Delete node
        const handleDeleteNode = useCallback((index) => {
            const nodeToDelete = nodes[index];

            // Check if any nodes reference this one
            const referencingNodes = nodes.filter(n =>
                n.Linked_Node_ID_xA === nodeToDelete.ID_xA
            );

            // Always show confirmation, but with different styling/message for referenced nodes
            if (referencingNodes.length > 0) {
                setDeleteConfirm({
                    index,
                    message: `"${nodeToDelete.ID_xA}" is referenced by ${referencingNodes.length} node(s). Confirm delete?`,
                    isReferenced: true
                });
            } else {
                setDeleteConfirm({
                    index,
                    message: `"${nodeToDelete.ID_xA}". Confirm delete?`,
                    isReferenced: false
                });
            }
        }, [nodes]);

        // Delete entire group
        const handleDeleteGroup = useCallback((groupName) => {
            const groupNodes = nodes.filter(n => n.Group_xA === groupName);
            const nodeCount = groupNodes.length;

            // Check if any nodes in this group are referenced by nodes outside the group
            const externalReferences = nodes.filter(n =>
                n.Group_xA !== groupName &&
                groupNodes.some(gn => gn.ID_xA === n.Linked_Node_ID_xA)
            );

            if (externalReferences.length > 0) {
                setDeleteConfirm({
                    groupName,
                    message: `Delete entire group "${groupName}" (${nodeCount} nodes)? ${externalReferences.length} external reference(s) will break.`,
                    isReferenced: true,
                    isGroup: true
                });
            } else {
                setDeleteConfirm({
                    groupName,
                    message: `Delete entire group "${groupName}" (${nodeCount} nodes)?`,
                    isReferenced: false,
                    isGroup: true
                });
            }
        }, [nodes]);

        // Duplicate node
        const handleDuplicateRow = useCallback((index) => {
            const nodeToDuplicate = nodes[index];
            const group = nodeToDuplicate.Group_xA;
            const baseNodeName = nodeToDuplicate.Node_xA;

            // Find unique name with _N suffix (same pattern as group duplication)
            const escapedBase = baseNodeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(`^${escapedBase}_(\\d+)$`);

            let maxSuffix = 0;

            // Check if base name exists
            if (nodes.some(n => n.Node_xA === baseNodeName && n.Group_xA === group)) {
                maxSuffix = 1;
            }

            // Find highest suffix number for this node name in this group
            nodes.forEach(node => {
                if (node.Group_xA === group) {
                    const match = node.Node_xA.match(pattern);
                    if (match) {
                        const suffix = parseInt(match[1]);
                        maxSuffix = Math.max(maxSuffix, suffix);
                    }
                }
            });

            const newNodeName = `${baseNodeName}_${maxSuffix + 1}`;
            const newID = window.GraphApp.utils.generateID(group, newNodeName);

            const duplicatedNode = {
                Group_xA: group,
                Node_xA: newNodeName,
                ID_xA: newID,
                Linked_Node_ID_xA: '',  // NO link cloning
                Hidden_Node_xB: nodeToDuplicate.Hidden_Node_xB,
                Hidden_Link_xB: 0,
                Link_Label_xB: '',  // NO label cloning
                Link_Arrow_xB: nodeToDuplicate.Link_Arrow_xB,
                AI_Rank_xB: nodeToDuplicate.AI_Rank_xB !== undefined ? nodeToDuplicate.AI_Rank_xB : '',
                Rank_xB: '',  // Clear rank for new copy
                Class1_xB: nodeToDuplicate.Class1_xB || '',
                Class2_xB: nodeToDuplicate.Class2_xB || '',
                Class3_xB: nodeToDuplicate.Class3_xB || '',
                Group_Info: nodeToDuplicate.Group_Info || '',  // Copy group info
                Node_Info: '',  // Clear node info
                Link_Info: ''  // Clear link info (new link gets new notes)
            };

            // Insert the duplicated row right after the original
            const newNodes = [
                ...nodes.slice(0, index + 1),
                duplicatedNode,
                ...nodes.slice(index + 1)
            ];

            setNodes(newNodes);

            // Validate after duplication
            const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
            setErrors(validationErrors);

            // Save to history
            saveToHistory(newNodes);
        }, [nodes, saveToHistory]);

        // Duplicate entire group
        const handleDuplicateGroup = useCallback((groupName) => {
            // Find all nodes in the group
            const groupNodes = nodes.filter(n => n.Group_xA === groupName);

            if (groupNodes.length === 0) return;

            // Generate unique group name with _N suffix
            const newGroupName = window.GraphApp.utils.generateUniqueGroupName(groupName, nodes);

            // Clone nodes with new group name and NO links
            const clonedNodes = groupNodes.map(node => ({
                Group_xA: newGroupName,
                Node_xA: node.Node_xA,
                ID_xA: window.GraphApp.utils.generateID(newGroupName, node.Node_xA),
                Linked_Node_ID_xA: '',  // NO links
                Hidden_Node_xB: node.Hidden_Node_xB || 0,
                Hidden_Link_xB: 0,
                Link_Label_xB: '',  // NO labels
                Link_Arrow_xB: node.Link_Arrow_xB || 'To',
                AI_Rank_xB: node.AI_Rank_xB !== undefined ? node.AI_Rank_xB : '',
                Rank_xB: '',  // Clear rank for new copy
                Class1_xB: node.Class1_xB || '',
                Class2_xB: node.Class2_xB || '',
                Class3_xB: node.Class3_xB || '',
                Group_Info: node.Group_Info || '',  // Copy group info
                Node_Info: ''  // Clear node info
            }));

            // Find insertion point (after last node of the group)
            const lastGroupIndex = nodes.reduce((lastIdx, node, idx) => {
                return node.Group_xA === groupName ? idx : lastIdx;
            }, -1);

            const newNodes = [
                ...nodes.slice(0, lastGroupIndex + 1),
                ...clonedNodes,
                ...nodes.slice(lastGroupIndex + 1)
            ];

            setNodes(newNodes);

            // Keep the new group collapsed
            setCollapsedGroups(new Set([...collapsedGroups, newGroupName]));

            // Validate after duplication
            const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
            setErrors(validationErrors);

            // Save to history
            saveToHistory(newNodes);
        }, [nodes, collapsedGroups, saveToHistory]);

        // Confirm delete
        const confirmDelete = useCallback(() => {
            if (deleteConfirm) {
                let newNodes;

                if (deleteConfirm.isGroup) {
                    // Delete entire group
                    newNodes = nodes.filter(n => n.Group_xA !== deleteConfirm.groupName);
                    // Also remove from collapsed groups
                    const newCollapsedGroups = new Set(collapsedGroups);
                    newCollapsedGroups.delete(deleteConfirm.groupName);
                    setCollapsedGroups(newCollapsedGroups);
                } else {
                    // Delete single node
                    newNodes = nodes.filter((_, i) => i !== deleteConfirm.index);
                }

                setNodes(newNodes);
                setDeleteConfirm(null);

                // Validate after deletion
                const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
                setErrors(validationErrors);

                // Save to history
                saveToHistory(newNodes);
            }
        }, [deleteConfirm, nodes, collapsedGroups, saveToHistory]);

        // Edit cell - IMPORTANT: Create new object references to satisfy React immutability
        // Accepts either index (number) or nodeId (string) as first parameter
        const handleCellEdit = useCallback((indexOrId, field, value) => {
            // Support both index (from table) and ID (from card)
            let index = indexOrId;
            if (typeof indexOrId === 'string') {
                index = nodes.findIndex(n => n.ID_xA === indexOrId);
                if (index === -1) return;  // Node not found
            }

            // Deep-ish clone: new array with new objects (prevents state mutation)
            const newNodes = nodes.map(n => ({ ...n }));
            const oldNode = nodes[index]; // Reference original for comparison

            // Special case: editing Group_xA on a collapsed group
            if (field === 'Group_xA' && collapsedGroups.has(oldNode.Group_xA)) {
                const oldGroupName = oldNode.Group_xA;
                const newGroupName = value;

                // Update ALL nodes in this group
                newNodes.forEach((node, i) => {
                    if (node.Group_xA === oldGroupName) {
                        const oldID = node.ID_xA;
                        newNodes[i].Group_xA = newGroupName;
                        newNodes[i].ID_xA = window.GraphApp.utils.generateID(newGroupName, node.Node_xA);

                        // Update all references to this old ID
                        // IMPORTANT: Only track non-empty IDs - prevents empty Linked_To cells from snapping
                        if (oldID && newNodes[i].ID_xA) {
                            newNodes.forEach((refNode, j) => {
                                if (refNode.Linked_Node_ID_xA === oldID) {
                                    newNodes[j].Linked_Node_ID_xA = newNodes[i].ID_xA;
                                }
                            });
                        }
                    }
                });

                // Update collapsed groups set
                const newCollapsed = new Set(collapsedGroups);
                newCollapsed.delete(oldGroupName);
                newCollapsed.add(newGroupName);
                setCollapsedGroups(newCollapsed);
            } else {
                // Normal cell edit
                newNodes[index][field] = value;

                // Auto-update ID if Group or Node changed AND track references
                if (field === 'Group_xA' || field === 'Node_xA') {
                    const oldID = oldNode.ID_xA;
                    const newID = window.GraphApp.utils.generateID(
                        newNodes[index].Group_xA,
                        newNodes[index].Node_xA
                    );
                    newNodes[index].ID_xA = newID;

                    // Excel-style reference tracking: update all references to old ID
                    // IMPORTANT: Only track non-empty IDs - prevents empty Linked_To cells from snapping
                    if (oldID && newID && oldID !== newID) {
                        newNodes.forEach((node, i) => {
                            if (node.Linked_Node_ID_xA === oldID) {
                                newNodes[i].Linked_Node_ID_xA = newID;
                            }
                        });
                    }
                }
            }

            setNodes(newNodes);

            // Revalidate
            const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
            setErrors(validationErrors);

            // Save to history
            saveToHistory(newNodes);
        }, [nodes, collapsedGroups, saveToHistory]);

        // Controlled commit helpers for Group/Node fields (prevents live merge bug)
        const commitCellEdit = useCallback(() => {
            if (!editingCell) return;

            const { index, field, value, originalValue } = editingCell;
            const trimmedValue = value.trim();

            // Only commit if value actually changed
            if (trimmedValue !== originalValue) {
                handleCellEdit(index, field, trimmedValue);
            }

            setEditingCell(null);
        }, [editingCell, handleCellEdit]);

        const cancelCellEdit = useCallback(() => {
            // Revert to original - just clear editing state (input will show node value again)
            setEditingCell(null);
        }, []);

        // Group visibility handlers
        const toggleGroup = useCallback((groupName) => {
            const newHiddenGroups = new Set(hiddenGroups);
            if (newHiddenGroups.has(groupName)) {
                newHiddenGroups.delete(groupName);
            } else {
                newHiddenGroups.add(groupName);
            }
            setHiddenGroups(newHiddenGroups);
        }, [hiddenGroups]);

        const toggleGroupCollapse = useCallback((groupName) => {
            const newCollapsedGroups = new Set(collapsedGroups);
            if (newCollapsedGroups.has(groupName)) {
                newCollapsedGroups.delete(groupName);
            } else {
                newCollapsedGroups.add(groupName);
            }
            setCollapsedGroups(newCollapsedGroups);
        }, [collapsedGroups]);

        const collapseAllGroups = useCallback(() => {
            // Get all unique group names
            const allGroups = new Set(nodes.map(n => n.Group_xA).filter(g => g));
            setCollapsedGroups(allGroups);
        }, [nodes]);

        const expandAllGroups = useCallback(() => {
            setCollapsedGroups(new Set());
        }, []);

        const showAllGroups = useCallback(() => {
            setHiddenGroups(new Set());
        }, []);

        const hideAllGroups = useCallback(() => {
            // Get all unique group names
            const allGroups = new Set(nodes.map(n => n.Group_xA).filter(g => g));
            setHiddenGroups(allGroups);
        }, [nodes]);

        // Toggle light/dark theme
        const toggleTheme = useCallback(() => {
            const newTheme = theme === 'light' ? 'dark' : 'light';
            setTheme(newTheme);
            // Update DOM and localStorage via theme config
            if (window.GraphApp.config.theme) {
                window.GraphApp.config.theme.setTheme(newTheme);
            } else {
                // Fallback if theme.js not loaded
                document.documentElement.setAttribute('data-theme', newTheme);
                document.documentElement.classList.toggle('dark', newTheme === 'dark');
                localStorage.setItem('haystack-theme', newTheme);
            }
        }, [theme]);

        // Export handlers
        const handleExportCSV = useCallback(() => {
            window.GraphApp.exports.exportCSV(nodes, 'graph-data.csv', blockedRoots);
            setShowExportModal(false);
        }, [nodes, blockedRoots]);

        const handleExportRootsCSV = useCallback(() => {
            window.GraphApp.exports.exportRootsCSV(nodes, 'roots.csv');
            setShowExportModal(false);
        }, [nodes]);

        const handleExportExcel = useCallback(async () => {
            try {
                await window.GraphApp.core.exportExcel(nodes, 'graph-data.xlsx');
                setShowExportModal(false);
            } catch (error) {
                alert('Error exporting Excel: ' + error.message);
            }
        }, [nodes]);

        const handleExportMermaid = useCallback(() => {
            const mermaidSyntax = window.GraphApp.core.generateMermaid(nodes, settings, hiddenGroups);
            window.GraphApp.exports.exportMermaid(mermaidSyntax, 'graph.mmd');
            setShowExportModal(false);
        }, [nodes, settings, hiddenGroups]);


        const handleExportJSON = useCallback(() => {
            window.GraphApp.exports.exportJSON(nodes, 'graph-data.json');
            setShowExportModal(false);
        }, [nodes]);

        const handleExportGraphML = useCallback(() => {
            window.GraphApp.exports.exportGraphML(nodes, 'graph.graphml');
            setShowExportModal(false);
        }, [nodes]);

        const handleExportDOT = useCallback(() => {
            window.GraphApp.exports.exportDOT(nodes, 'graph.dot', settings);
            setShowExportModal(false);
        }, [nodes, settings]);

        // TXT export handler
        const handleExportTXT = useCallback(() => {
            window.GraphApp.exports.exportTXT(nodes, 'graph-data.txt', blockedRoots);
            setShowExportModal(false);
        }, [nodes, blockedRoots]);

        // Clipboard handler
        const handleCopyToClipboard = useCallback(async () => {
            const success = await window.GraphApp.exports.copyToClipboard(nodes, blockedRoots);
            if (success) {
                alert('Copied to clipboard!');
            } else {
                alert('Failed to copy to clipboard');
            }
            setShowExportModal(false);
        }, [nodes, blockedRoots]);

        // Load demo by name
        const loadDemo = useCallback((demoName) => {
            const demos = window.GraphApp.data.demos;
            const demoData = demos[demoName] || Object.values(demos)[0] || [];

            // Spread to create new array reference (forces re-render even if same data)
            setNodes([...demoData]);
            setShowDemoMenu(false);
            setCurrentFileName(demoName);  // Show demo name in toolbar

            // Validate demo data
            const validationErrors = window.GraphApp.utils.validateNodes(demoData);
            setErrors(validationErrors);
        }, []);

        // ========== GRID MODE HANDLERS ==========

        // Filter and sort nodes for grid display
        const filteredGridNodes = useMemo(() => {
            const filterFn = window.GraphApp.utils.filterGridNodes;
            const sortFn = window.GraphApp.utils.sortGridNodes;
            if (!filterFn || !sortFn) return nodes;

            // Start with all nodes
            let filtered = nodes;

            // Apply class filter in root mode (selected classes are visible)
            if (dataFormat === 'roots') {
                filtered = filtered.filter(n => selectedTerritories.has(n.Group_xA));
                // Filter out blocked roots (engagement=0) if showBlockedRoots is false
                if (!showBlockedRoots) {
                    filtered = filtered.filter(n => n.AI_Rank_xB !== 0);
                }
            }

            // Merge filterMatrix into filters for the filter function
            const filtersWithMatrix = Object.assign({}, gridFilters, { filterMatrix: filterMatrix });
            filtered = filterFn(filtered, filtersWithMatrix, blockedRoots);
            return sortFn(filtered, gridFilters.sortBy || 'ai-desc');
        }, [nodes, gridFilters, filterMatrix, dataFormat, selectedTerritories, showBlockedRoots, blockedRoots]);

        // Page count for pagination (compact mode shows more cards per page)
        const gridPageSize = compactView ? gridSize * 20 : gridSize * gridSize;
        const gridPageCount = useMemo(() => {
            return Math.ceil(filteredGridNodes.length / gridPageSize) || 1;
        }, [filteredGridNodes.length, gridPageSize]);

        // Reset page when filters change
        useEffect(() => {
            setCurrentPage(0);
        }, [gridFilters, gridSize]);

        // Helper: Get base group name (strip rating suffix like " T1", " T2", " T3", " Blocked")
        const getBaseGroup = useCallback((group) => {
            if (!group) return '';
            return group.replace(/\s+(T[123]|Blocked)$/i, '');
        }, []);

        // Helper: Compute new group name based on rating
        const getGroupWithRating = useCallback((baseGroup, score) => {
            if (!baseGroup) return baseGroup;
            if (score === 0) return baseGroup + ' Blocked';
            if (score === 1) return baseGroup + ' T1';
            if (score === 2) return baseGroup + ' T2';
            if (score === 3) return baseGroup + ' T3';
            return baseGroup; // Unrated - just base group
        }, []);

        // Helper: Update node with new group, ID, and update references
        const updateNodeGroupAndId = useCallback((nodes, nodeId, newScore) => {
            // First pass: find the node and compute new group/ID
            const targetNode = nodes.find(n => n.ID_xA === nodeId);
            if (!targetNode) return nodes;

            const baseGroup = getBaseGroup(targetNode.Group_xA);
            const newGroup = getGroupWithRating(baseGroup, newScore);
            const newId = newGroup + '-' + targetNode.Node_xA;
            const oldId = targetNode.ID_xA;

            // Second pass: update the node and any references to it
            return nodes.map(node => {
                if (node.ID_xA === oldId) {
                    // This is the target node - update group, ID, and rank
                    return {
                        ...node,
                        Group_xA: newGroup,
                        ID_xA: newId,
                        Rank_xB: newScore
                    };
                } else if (node.Linked_Node_ID_xA === oldId) {
                    // This node references the target - update the reference
                    return { ...node, Linked_Node_ID_xA: newId };
                }
                return node;
            });
        }, [getBaseGroup, getGroupWithRating]);

        // Handle grid score (with wave behavior in eval session)
        const handleGridScore = useCallback((candidateId, score) => {
            const evaluation = window.GraphApp.core.evaluation;

            // Record for undo
            historyRef.current.push(nodes);
            setCanUndo(true);
            setCanRedo(false);

            // Update Rank_xB, Group_xA, and ID_xA
            setNodes(prevNodes => {
                const newNodes = updateNodeGroupAndId(prevNodes, candidateId, score);
                const validationErrors = window.GraphApp.utils.validateNodes(newNodes);
                setErrors(validationErrors);
                return newNodes;
            });

            // If not in eval session, we're done (simple pagination mode)
            if (!isEvalSession || !evaluation) return;

            // Mark as exiting (triggers fade-out animation)
            setGridEvalExitingIds(prev => new Set([...prev, candidateId]));
            setGridEvalRatedCount(prev => prev + 1);

            // Find the candidate being removed to release its grid cell
            const currentBatch = gridEvalBatchRef.current;
            const departingCandidate = currentBatch.find(c => c.ID_xA === candidateId);

            // Animation duration (quick fade for block/rank-0, 2s for others)
            const animDuration = score === 0 ? 300 : 2000;

            setTimeout(function() {
                // Use refs for fresh values (avoid stale closures)
                const batchNow = gridEvalBatchRef.current;
                const currentNodes = nodesRef.current;
                const currentFilters = gridFiltersRef.current;

                // Release grid cell
                if (departingCandidate && departingCandidate.gridRow !== undefined && gridEvalGridRef.current) {
                    evaluation.releaseCell(departingCandidate.gridRow, departingCandidate.gridCol, gridEvalGridRef.current);
                }

                // Remove from current batch
                const newBatch = batchNow.filter(c => c.ID_xA !== candidateId);

                // Remove from exiting set
                setGridEvalExitingIds(prev => {
                    const next = new Set(prev);
                    next.delete(candidateId);
                    return next;
                });

                if (newBatch.length === 0) {
                    // Wave empty - clear batch and pause before next wave
                    setGridEvalBatch([]);

                    // 1-second pause before next wave
                    setTimeout(function() {
                        const freshNodes = nodesRef.current;
                        const freshFilters = gridFiltersRef.current;

                        // Reset grid for new wave (all cells available)
                        gridEvalGridRef.current = evaluation.createGrid();

                        const nextWave = evaluation.getFilteredBatch(
                            freshNodes,
                            freshFilters,
                            [],  // No exclusions - batch is empty
                            gridEvalGridRef.current,
                            6    // Wave size
                        );

                        if (nextWave && nextWave.length > 0) {
                            setGridEvalBatch(nextWave);
                        } else {
                            // All done! Show message then auto-exit
                            setGridEvalAllDone(true);
                            setTimeout(function() {
                                setIsEvalSession(false);
                                setGridEvalBatch([]);
                                setGridEvalExitingIds(new Set());
                                setGridEvalAllDone(false);
                                gridEvalGridRef.current = null;
                            }, 1500);
                        }
                    }, 1000);
                } else {
                    // Still candidates in wave - update batch
                    setGridEvalBatch(newBatch);
                }
            }, animDuration);
        }, [nodes, isEvalSession, updateNodeGroupAndId]);

        // Handle grid skip (wave behavior in eval session)
        const handleGridSkip = useCallback((candidateId) => {
            const evaluation = window.GraphApp.core.evaluation;

            // Record for undo
            historyRef.current.push(nodes);
            setCanUndo(true);
            setCanRedo(false);

            // Set Rank_xB to empty and reset group to base (unrated)
            setNodes(prevNodes => {
                const newNodes = updateNodeGroupAndId(prevNodes, candidateId, '');
                return newNodes;
            });

            // If not in eval session, we're done (simple pagination mode)
            if (!isEvalSession || !evaluation) return;

            // Mark as exiting (triggers fade-out animation)
            setGridEvalExitingIds(prev => new Set([...prev, candidateId]));

            // Find the candidate being removed
            const currentBatch = gridEvalBatchRef.current;
            const departingCandidate = currentBatch.find(c => c.ID_xA === candidateId);

            // Fade-out animation (2 seconds)
            setTimeout(function() {
                const batchNow = gridEvalBatchRef.current;
                const currentNodes = nodesRef.current;
                const currentFilters = gridFiltersRef.current;

                // Release grid cell
                if (departingCandidate && departingCandidate.gridRow !== undefined && gridEvalGridRef.current) {
                    evaluation.releaseCell(departingCandidate.gridRow, departingCandidate.gridCol, gridEvalGridRef.current);
                }

                // Remove from current batch
                const newBatch = batchNow.filter(c => c.ID_xA !== candidateId);

                // Remove from exiting set
                setGridEvalExitingIds(prev => {
                    const next = new Set(prev);
                    next.delete(candidateId);
                    return next;
                });

                if (newBatch.length === 0) {
                    // Wave empty - pause then load next wave
                    setGridEvalBatch([]);

                    setTimeout(function() {
                        const freshNodes = nodesRef.current;
                        const freshFilters = gridFiltersRef.current;

                        gridEvalGridRef.current = evaluation.createGrid();

                        const nextWave = evaluation.getFilteredBatch(
                            freshNodes,
                            freshFilters,
                            [],
                            gridEvalGridRef.current,
                            6
                        );

                        if (nextWave && nextWave.length > 0) {
                            setGridEvalBatch(nextWave);
                        } else {
                            setGridEvalAllDone(true);
                            setTimeout(function() {
                                setIsEvalSession(false);
                                setGridEvalBatch([]);
                                setGridEvalExitingIds(new Set());
                                setGridEvalAllDone(false);
                                gridEvalGridRef.current = null;
                            }, 1500);
                        }
                    }, 1000);
                } else {
                    setGridEvalBatch(newBatch);
                }
            }, 2000);
        }, [nodes, isEvalSession, updateNodeGroupAndId]);

        // Block a root: add to blockedRoots only (no candidate mutation)
        // Root blocking is a display/filter layer separate from candidate ratings
        const handleBlockRoot = useCallback((root) => {
            setBlockedRoots(prev => new Set([...prev, root]));
        }, []);

        // Unblock a root: remove from blockedRoots only (no candidate mutation)
        // Candidate Rank_xB values remain unchanged
        const handleUnblockRoot = useCallback((root) => {
            setBlockedRoots(prev => {
                const next = new Set(prev);
                next.delete(root);
                return next;
            });
        }, []);

        // Toggle territory selection for root mode filtering
        const handleToggleTerritory = useCallback((territory) => {
            setSelectedTerritories(prev => {
                const next = new Set(prev);
                if (next.has(territory)) {
                    next.delete(territory);
                } else {
                    next.add(territory);
                }
                return next;
            });
        }, []);

        // Show all classes (select all territories)
        const handleShowAllClasses = useCallback(() => {
            const allClasses = new Set(nodes.map(n => n.Group_xA).filter(Boolean));
            setSelectedTerritories(allClasses);
        }, [nodes]);

        // Hide all classes (deselect all territories)
        const handleHideAllClasses = useCallback(() => {
            setSelectedTerritories(new Set());
        }, []);

        // Count occurrences of a root across all nodes
        const countByRoot = useCallback((rootValue) => {
            return nodes.filter(node =>
                node.Root1_xB === rootValue ||
                node.Root2_xB === rootValue ||
                node.Root3_xB === rootValue
            ).length;
        }, [nodes]);

        // Start eval session (wave-based, uses CURRENT filter state)
        const handleStartGridEval = useCallback(() => {
            const evaluation = window.GraphApp.core.evaluation;
            if (!evaluation) {
                console.error('Evaluation engine not available');
                return;
            }

            // Use current filters (don't reset) - eval starts from whatever user has filtered
            const currentFilters = gridFiltersRef.current;

            // Create grid for cell tracking
            gridEvalGridRef.current = evaluation.createGrid();

            // Get first wave (6 candidates) using current filter state
            const firstWave = evaluation.getFilteredBatch(
                nodes,
                currentFilters,
                [],  // No exclusions initially
                gridEvalGridRef.current,
                6    // Wave size
            );

            // Set initial state (filters are now locked during eval)
            setGridEvalBatch(firstWave);
            setGridEvalExitingIds(new Set());
            setGridEvalAllDone(false);
            setGridEvalRatedCount(0);
            setCurrentPage(0);
            setIsEvalSession(true);
        }, [nodes]);

        // Exit eval session
        const handleExitGridEval = useCallback(() => {
            setIsEvalSession(false);
            setGridEvalBatch([]);
            setGridEvalExitingIds(new Set());
            setGridEvalAllDone(false);
            setGridEvalRatedCount(0);
            gridEvalGridRef.current = null;
        }, []);

        // ========== END GRID-FIRST MODE HANDLERS ==========

        // Render main UI
        return React.createElement('div', {
            className: "h-screen flex flex-col bg-gray-100 dark:bg-gray-900 overflow-hidden"
        }, [
            // Toolbar
            React.createElement('div', {
                key: 'toolbar',
                className: "bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700"
            }, [
                React.createElement('div', {
                    key: 'toolbar-content',
                    className: "px-3 py-1.5"
                }, [
                    React.createElement('div', {
                        key: 'toolbar-flex',
                        className: "flex items-center gap-2"
                    }, [
                        // Help button
                        React.createElement('button', {
                            key: 'help-btn',
                            onClick: () => setShowHelpModal(true),
                            className: "flex items-center justify-center w-6 h-6 text-sm font-bold text-blue-600 bg-blue-100 hover:bg-blue-200 rounded-full mr-2",
                            title: "Help"
                        }, "?"),

                        // File operations
                        React.createElement('div', {
                            key: 'file-ops',
                            className: "flex gap-1"
                        }, [
                            React.createElement('label', {
                                key: 'import',
                                className: "flex items-center px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
                            }, [
                                React.createElement(Upload, {
                                    key: 'icon',
                                    size: 12,
                                    className: "mr-1"
                                }),
                                "Import",
                                React.createElement('input', {
                                    key: 'input',
                                    ref: fileInputRef,
                                    type: "file",
                                    accept: ".csv,.xlsx,.xls,.mmd,.txt",
                                    onChange: handleFileUpload,
                                    className: "hidden"
                                })
                            ]),

                            React.createElement('button', {
                                key: 'add',
                                onClick: handleAddNode,
                                className: "flex items-center px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                            }, [
                                React.createElement(Plus, {
                                    key: 'icon',
                                    size: 12,
                                    className: "mr-1"
                                }),
                                "Add Node"
                            ]),

                            // AI Generate button (only shown when API key is configured)
                            ...(apiKey ? [
                                React.createElement('button', {
                                    key: 'ai-generate',
                                    onClick: () => setShowAIModal(true),
                                    className: "flex items-center px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600"
                                }, [
                                    React.createElement(Sparkles, {
                                        key: 'icon',
                                        size: 12,
                                        className: "mr-1"
                                    }),
                                    "AI Generate"
                                ])
                            ] : []),

                        ]),

                        // Undo/Redo buttons
                        React.createElement('div', {
                            key: 'undo-redo',
                            className: "flex gap-0.5"
                        }, [
                            React.createElement('button', {
                                key: 'undo',
                                onClick: handleUndo,
                                disabled: !canUndo,
                                className: canUndo
                                    ? "p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                    : "p-1.5 text-gray-300 dark:text-gray-600 cursor-not-allowed",
                                title: "Undo (Ctrl+Z)"
                            }, React.createElement(RotateCcw, { size: 16 })),
                            React.createElement('button', {
                                key: 'redo',
                                onClick: handleRedo,
                                disabled: !canRedo,
                                className: canRedo
                                    ? "p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                    : "p-1.5 text-gray-300 dark:text-gray-600 cursor-not-allowed",
                                title: "Redo (Ctrl+Shift+Z)"
                            }, React.createElement(RotateCw, { size: 16 }))
                        ]),

                        React.createElement('div', {
                            key: 'div1',
                            className: "w-px h-6 bg-gray-300 dark:bg-gray-600"
                        }),

                        // Export button
                        React.createElement('button', {
                            key: 'export',
                            onClick: () => setShowExportModal(true),
                            disabled: nodes.length === 0,
                            className: `flex items-center px-2 py-1 text-xs rounded ${nodes.length > 0 ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-400 text-gray-200'}`
                        }, [
                            React.createElement(Download, {
                                key: 'icon',
                                size: 12,
                                className: "mr-1"
                            }),
                            "Export"
                        ]),

                        // Demos dropdown
                        React.createElement('div', {
                            key: 'div2',
                            className: "w-px h-6 bg-gray-300 dark:bg-gray-600"
                        }),
                        React.createElement('div', {
                            key: 'demos-dropdown',
                            className: "relative",
                            'data-demos-dropdown': true
                        }, [
                            React.createElement('button', {
                                key: 'demos-btn',
                                onClick: () => setShowDemoMenu(!showDemoMenu),
                                className: "flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                            }, [
                                "Demos",
                                React.createElement('span', { key: 'arrow', className: "text-[10px]" }, showDemoMenu ? "▲" : "▼")
                            ]),
                            showDemoMenu && React.createElement('div', {
                                key: 'demos-menu',
                                className: "absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-50 min-w-[140px]"
                            }, Object.keys(window.GraphApp.data.demos).map(demoName =>
                                React.createElement('button', {
                                    key: demoName,
                                    onClick: () => loadDemo(demoName),
                                    className: "block w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t last:rounded-b"
                                }, demoName)
                            ))
                        ]),

                        // Move row up/down buttons
                        React.createElement('div', {
                            key: 'div-move',
                            className: "w-px h-6 bg-gray-300 dark:bg-gray-600"
                        }),
                        React.createElement('button', {
                            key: 'move-up',
                            onClick: handleMoveUp,
                            disabled: !canMoveUp,
                            className: canMoveUp
                                ? "p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                                : "p-1.5 rounded text-gray-300 dark:text-gray-600 cursor-not-allowed",
                            title: "Move row up (within group)"
                        }, React.createElement(ArrowUp, { size: 16 })),
                        React.createElement('button', {
                            key: 'move-down',
                            onClick: handleMoveDown,
                            disabled: !canMoveDown,
                            className: canMoveDown
                                ? "p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                                : "p-1.5 rounded text-gray-300 dark:text-gray-600 cursor-not-allowed",
                            title: "Move row down (within group)"
                        }, React.createElement(ArrowDown, { size: 16 })),

                        // Filename display (unobtrusive, only shown when file is loaded)
                        ...(currentFileName ? [
                            React.createElement('span', {
                                key: 'filename',
                                className: "text-xs text-gray-400 dark:text-gray-500 ml-2 truncate max-w-[150px]",
                                title: currentFileName
                            }, currentFileName)
                        ] : []),

                        // Mode indicator badge
                        dataFormat === 'roots' && React.createElement('span', {
                            key: 'mode-badge',
                            className: "px-2 py-1 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full ml-2"
                        }, "Root Mode"),
                        dataFormat === 'candidates' && nodes.length > 0 && React.createElement('span', {
                            key: 'mode-badge',
                            className: "px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full ml-2"
                        }, "Candidates"),

                        // Theme toggle and Settings buttons
                        React.createElement('div', {
                            key: 'settings-separator',
                            className: "w-px h-6 bg-gray-300 dark:bg-gray-600 ml-2"
                        }),
                        React.createElement('button', {
                            key: 'theme-toggle-btn',
                            onClick: toggleTheme,
                            className: "p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300",
                            title: theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"
                        }, theme === 'dark' ? React.createElement(Sun, { size: 16 }) : React.createElement(Moon, { size: 16 })),
                        React.createElement('button', {
                            key: 'settings-btn',
                            onClick: () => setShowSettingsModal(true),
                            className: "p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300",
                            title: "Settings (API Key)"
                        }, React.createElement(Settings, { size: 16 }))
                    ])
                ])
            ]),

            // Error banner
            ...(errors.length > 0 ? [
                React.createElement('div', {
                    key: 'errors',
                    className: "bg-red-50 border-b border-red-200 px-4 py-2"
                }, [
                    React.createElement('div', {
                        key: 'error-title',
                        className: "flex items-center gap-2 text-sm text-red-800 font-semibold mb-1"
                    }, [
                        React.createElement(AlertCircle, { key: 'icon', size: 16 }),
                        React.createElement('span', { key: 'text' }, `${errors.length} Error(s) Found`)
                    ]),
                    React.createElement('ul', {
                        key: 'error-list',
                        className: "text-xs text-red-700 list-disc list-inside"
                    }, errors.map((error, i) =>
                        React.createElement('li', { key: i }, error)
                    ))
                ])
            ] : []),

            // Main content area - Grid only
            React.createElement('div', {
                key: 'main-content',
                className: "flex-1 flex overflow-hidden"
            }, [
                // Grid panel
                React.createElement('div', {
                    key: 'grid-panel',
                    className: 'flex-1 flex overflow-hidden'
                }, [
                    // Filter Panel
                    window.GraphApp.components.FilterPanel && React.createElement(window.GraphApp.components.FilterPanel, {
                        key: 'filter-panel',
                        filters: gridFilters,
                        setFilters: setGridFilters,
                        gridSize: gridSize,
                        setGridSize: setGridSize,
                        groups: uniqueGroups,
                        groupCounts: groupCounts,
                        stats: rankStats,
                        isEvalSession: isEvalSession,
                        onStartEval: handleStartGridEval,
                        onExitEval: handleExitGridEval,
                        filteredCount: filteredGridNodes.length,
                        totalCount: nodes.length,
                        evalRatedCount: gridEvalRatedCount,
                        // Pagination props
                        currentPage: currentPage,
                        totalPages: gridPageCount,
                        onPageChange: setCurrentPage,
                        pageSize: gridPageSize,
                        // Filter matrix props
                        filterMatrix: filterMatrix,
                        setFilterMatrix: setFilterMatrix,
                        visibleColumns: visibleColumns,
                        matrixCounts: matrixCounts,
                        // Compact view props
                        compactView: compactView,
                        setCompactView: setCompactView,
                        // Add node handler
                        onAddNode: handleAddNode,
                        // Class filter props (root mode)
                        dataFormat: dataFormat,
                        selectedTerritories: selectedTerritories,
                        onToggleTerritory: handleToggleTerritory,
                        onShowAllClasses: handleShowAllClasses,
                        onHideAllClasses: handleHideAllClasses,
                        // Show/hide blocked roots
                        showBlockedRoots: showBlockedRoots,
                        setShowBlockedRoots: setShowBlockedRoots
                    }),
                    // Grid Display (receives pre-filtered nodes for territory/class filtering)
                    window.GraphApp.components.GridDisplay && React.createElement(window.GraphApp.components.GridDisplay, {
                        key: 'grid-display',
                        nodes: filteredGridNodes,
                        filters: Object.assign({}, gridFilters, { filterMatrix: filterMatrix }),
                        gridSize: gridSize,
                        currentPage: currentPage,
                        onPageChange: setCurrentPage,
                        onScore: handleGridScore,
                        onSkip: handleGridSkip,
                        blockedRoots: blockedRoots,
                        onBlockRoot: handleBlockRoot,
                        onUnblockRoot: handleUnblockRoot,
                        countByRoot: countByRoot,
                        isEvalSession: isEvalSession,
                        evalBatch: gridEvalBatch,
                        evalExitingIds: gridEvalExitingIds,
                        evalAllDone: gridEvalAllDone,
                        evalRatedCount: gridEvalRatedCount,
                        compactView: compactView,
                        onEdit: handleCellEdit,
                        dataFormat: dataFormat
                    })
                ])
            ]),

            // Export modal - Single column layout
            showExportModal && React.createElement('div', {
                key: 'export-modal',
                className: "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center modal-overlay",
                onClick: () => setShowExportModal(false)
            }, React.createElement('div', {
                key: 'modal-content',
                className: "bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4",
                onClick: (e) => e.stopPropagation()
            }, [
                React.createElement('h3', {
                    key: 'title',
                    className: "text-lg font-semibold mb-4 text-center"
                }, "Export"),

                // Export buttons
                React.createElement('div', {
                    key: 'export-buttons',
                    className: "space-y-2 mb-4"
                }, [
                    React.createElement('button', {
                        key: 'csv', onClick: handleExportCSV,
                        className: "w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                    }, [
                        React.createElement(FileText, { key: 'i', size: 14, className: "text-gray-600" }),
                        React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "CSV")
                    ]),
                    React.createElement('button', {
                        key: 'roots-csv', onClick: handleExportRootsCSV,
                        className: "w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                    }, [
                        React.createElement(FileText, { key: 'i', size: 14, className: "text-green-600" }),
                        React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "Roots CSV")
                    ]),
                    React.createElement('button', {
                        key: 'txt', onClick: handleExportTXT,
                        className: "w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                    }, [
                        React.createElement(FileText, { key: 'i', size: 14, className: "text-gray-500" }),
                        React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "TXT")
                    ]),
                    React.createElement('button', {
                        key: 'clipboard', onClick: handleCopyToClipboard,
                        className: "w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-green-50 rounded border border-gray-200 hover:border-green-300"
                    }, [
                        React.createElement(Copy, { key: 'i', size: 14, className: "text-green-600" }),
                        React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "Clipboard")
                    ]),
                    React.createElement('button', {
                        key: 'excel', onClick: handleExportExcel,
                        className: "w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                    }, [
                        React.createElement(File, { key: 'i', size: 14, className: "text-green-600" }),
                        React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "Excel")
                    ]),
                    React.createElement('button', {
                        key: 'json', onClick: handleExportJSON,
                        className: "w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded border border-gray-200 hover:border-blue-200"
                    }, [
                        React.createElement(FileText, { key: 'i', size: 14, className: "text-yellow-600" }),
                        React.createElement('span', { key: 'n', className: "text-xs font-medium" }, "JSON")
                    ])
                ]),

                // Red disclaimer at bottom
                React.createElement('p', {
                    key: 'disclaimer',
                    className: "text-xs text-red-600 mb-3 pt-3 border-t border-red-200"
                }, "Disclaimer: This application is provided as-is for demonstration purposes only. The developers assume no responsibility for data loss, errors, or any damages resulting from its use."),

                React.createElement('button', {
                    key: 'close',
                    onClick: () => setShowExportModal(false),
                    className: "w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                }, "Close")
            ])),

            // Delete confirmation modal
            deleteConfirm && React.createElement('div', {
                key: 'delete-modal',
                className: "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center",
                onClick: () => setDeleteConfirm(null)
            }, React.createElement('div', {
                key: 'modal-content',
                className: `bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 ${deleteConfirm.isReferenced ? 'border-2 border-red-500' : ''}`,
                onClick: (e) => e.stopPropagation()
            }, [
                React.createElement('h3', {
                    key: 'title',
                    className: `text-lg font-semibold mb-3 ${deleteConfirm.isReferenced ? 'text-red-600' : ''}`
                }, deleteConfirm.message),
                React.createElement('div', {
                    key: 'buttons',
                    className: "flex gap-3 justify-end mt-6"
                }, [
                    React.createElement('button', {
                        key: 'cancel',
                        onClick: () => setDeleteConfirm(null),
                        className: "px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    }, "Cancel"),
                    React.createElement('button', {
                        key: 'confirm',
                        onClick: confirmDelete,
                        className: "px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    }, "Delete")
                ])
            ])),

            // Help modal
            showHelpModal && React.createElement('div', {
                key: 'help-modal',
                className: "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center modal-overlay",
                onClick: () => setShowHelpModal(false)
            }, React.createElement('div', {
                key: 'modal-content',
                className: "bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto",
                onClick: (e) => e.stopPropagation()
            }, [
                React.createElement('h3', {
                    key: 'title',
                    className: "text-lg font-semibold mb-4 text-gray-800"
                }, "Help"),

                // Data Model
                React.createElement('div', { key: 'data-model', className: "mb-4" }, [
                    React.createElement('h4', { key: 'h', className: "text-sm font-semibold text-gray-700 mb-2" }, "Data Model"),
                    React.createElement('p', { key: 'p', className: "text-xs text-gray-600" }, "Group | Node | Linked To | Label"),
                    React.createElement('p', { key: 'id', className: "text-xs text-gray-500 mt-1" }, "ID = Group-Node (auto-generated, refs auto-update on rename)")
                ]),

                // Group Operations
                React.createElement('div', { key: 'group-ops', className: "mb-4" }, [
                    React.createElement('h4', { key: 'h', className: "text-sm font-semibold text-gray-700 mb-2" }, "Group Operations"),
                    React.createElement('table', { key: 't', className: "w-full text-xs" }, [
                        React.createElement('tbody', { key: 'tb' }, [
                            React.createElement('tr', { key: '1' }, [
                                React.createElement('td', { key: 'k', className: "font-medium pr-2" }, "Collapse / Expand"),
                                React.createElement('td', { key: 'v', className: "text-gray-600" }, "chevron on row (table only)")
                            ]),
                            React.createElement('tr', { key: '2' }, [
                                React.createElement('td', { key: 'k', className: "font-medium pr-2" }, "Hide / Show"),
                                React.createElement('td', { key: 'v', className: "text-gray-600" }, "eye on row (canvas)")
                            ]),
                            React.createElement('tr', { key: '3' }, [
                                React.createElement('td', { key: 'k', className: "font-medium pr-2" }, "All groups"),
                                React.createElement('td', { key: 'v', className: "text-gray-600" }, "icons in header")
                            ])
                        ])
                    ])
                ]),

                // Node Operations
                React.createElement('div', { key: 'node-ops', className: "mb-4" }, [
                    React.createElement('h4', { key: 'h', className: "text-sm font-semibold text-gray-700 mb-2" }, "Node Operations"),
                    React.createElement('table', { key: 't', className: "w-full text-xs" }, [
                        React.createElement('tbody', { key: 'tb' }, [
                            React.createElement('tr', { key: '1' }, [
                                React.createElement('td', { key: 'k', className: "font-medium pr-2" }, "Delete"),
                                React.createElement('td', { key: 'v', className: "text-gray-600" }, "trash icon (* if referenced)")
                            ]),
                            React.createElement('tr', { key: '2' }, [
                                React.createElement('td', { key: 'k', className: "font-medium pr-2" }, "Duplicate"),
                                React.createElement('td', { key: 'v', className: "text-gray-600" }, "copy icon on row")
                            ]),
                            React.createElement('tr', { key: '3' }, [
                                React.createElement('td', { key: 'k', className: "font-medium pr-2" }, "Clear link"),
                                React.createElement('td', { key: 'v', className: "text-gray-600" }, "X next to Linked To")
                            ])
                        ])
                    ])
                ]),

                // Canvas
                React.createElement('div', { key: 'canvas', className: "mb-4" }, [
                    React.createElement('h4', { key: 'h', className: "text-sm font-semibold text-gray-700 mb-2" }, "Canvas"),
                    React.createElement('p', { key: 'p', className: "text-xs text-gray-600" }, "Drag = pan | Scroll = zoom | Fit = reset")
                ]),

                // Validation
                React.createElement('div', { key: 'validation', className: "mb-4" }, [
                    React.createElement('h4', { key: 'h', className: "text-sm font-semibold text-gray-700 mb-2" }, "Validation"),
                    React.createElement('p', { key: 'p', className: "text-xs text-gray-600" }, "\uD83D\uDFE1 Duplicate ID")
                ]),

                // Disclaimer
                React.createElement('p', {
                    key: 'disclaimer',
                    className: "text-xs text-red-600 mt-4 pt-3 border-t border-gray-200"
                }, "Disclaimer: This application is provided as-is for demonstration purposes. The developers assume no responsibility for data loss, errors, or any damages resulting from its use."),

                React.createElement('button', {
                    key: 'close',
                    onClick: () => setShowHelpModal(false),
                    className: "mt-4 w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                }, "Close")
            ])),

            // Readme modal
            showReadmeModal && React.createElement('div', {
                key: 'readme-modal',
                className: "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center modal-overlay",
                onClick: () => setShowReadmeModal(false)
            }, React.createElement('div', {
                key: 'modal-content',
                className: "bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4",
                onClick: (e) => e.stopPropagation()
            }, [
                React.createElement('h3', {
                    key: 'title',
                    className: "text-lg font-semibold mb-4 text-gray-800"
                }, "AIdiagram.app"),
                React.createElement('div', {
                    key: 'content',
                    className: "text-sm text-gray-600 space-y-3"
                }, [
                    React.createElement('p', { key: 'p1' },
                        "This application is provided for demonstration and testing purposes only."
                    ),
                    React.createElement('p', { key: 'p2' },
                        "The developers make no warranties regarding accuracy, reliability, or fitness for any particular purpose. Use at your own risk."
                    ),
                    React.createElement('p', { key: 'p3' },
                        "The developers are not responsible for any damages, data loss, or other issues arising from use of this application."
                    ),
                    React.createElement('p', { key: 'p4', className: "text-xs text-gray-400 pt-2" },
                        "By using this application, you acknowledge and accept these terms."
                    )
                ]),
                React.createElement('button', {
                    key: 'close',
                    onClick: () => setShowReadmeModal(false),
                    className: "mt-4 w-full px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                }, "Close")
            ])),

            // Unified context menu (right-click on group/node/edge in canvas)
            contextMenu.open && (() => {
                const isGroup = contextMenu.type === 'group';
                const isNode = contextMenu.type === 'node';
                const isEdge = contextMenu.type === 'edge';
                const linkedGroups = isGroup ? getLinkedGroups(contextMenu.groupName) : new Set();
                const hasLinkedGroups = linkedGroups.size > 0;

                // Determine header text based on type
                const headerText = isGroup ? contextMenu.groupName
                    : isNode ? contextMenu.nodeId
                    : (contextMenu.edgeData?.sourceId + ' → ' + contextMenu.edgeData?.targetId);

                return React.createElement('div', {
                    key: 'context-menu',
                    className: "fixed z-50 bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-48",
                    style: {
                        left: contextMenu.position.x,
                        top: contextMenu.position.y
                    },
                    onClick: (e) => e.stopPropagation(),  // Prevent immediate close
                    onContextMenu: (e) => { e.preventDefault(); e.stopPropagation(); }  // Prevent browser menu on popup
                }, [
                    // Menu header (varies by type)
                    React.createElement('div', {
                        key: 'header',
                        className: "px-3 py-1.5 text-xs text-gray-500 border-b border-gray-100 truncate max-w-64"
                    }, headerText),

                    // Group-specific: If no linked groups, show message
                    isGroup && !hasLinkedGroups && React.createElement('div', {
                        key: 'no-links',
                        className: "px-3 py-2 text-sm text-gray-400 italic"
                    }, "No linked groups"),

                    // Group-specific: Show Linked Groups (only if has linked groups)
                    isGroup && hasLinkedGroups && React.createElement('button', {
                        key: 'show-linked',
                        className: "w-full px-3 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2",
                        onClick: () => showLinkedGroups(contextMenu.groupName)
                    }, [
                        React.createElement(Eye, { key: 'icon', size: 14 }),
                        "Show Linked Groups"
                    ]),

                    // Group-specific: Show ONLY Linked Groups (only if has linked groups)
                    isGroup && hasLinkedGroups && React.createElement('button', {
                        key: 'show-only-linked',
                        className: "w-full px-3 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2",
                        onClick: () => showOnlyLinkedGroups(contextMenu.groupName)
                    }, [
                        React.createElement(EyeOff, { key: 'icon', size: 14 }),
                        "Show ONLY Linked Groups"
                    ]),

                    // Separator (for groups with options, or always for node/edge)
                    (isGroup || isNode || isEdge) && React.createElement('div', {
                        key: 'separator',
                        className: "border-t border-gray-100 my-1"
                    }),

                    // Show Info - available for all types, calls appropriate function
                    React.createElement('button', {
                        key: 'show-info',
                        className: "w-full px-3 py-2 text-sm text-left hover:bg-gray-100 flex items-center gap-2",
                        onClick: () => {
                            if (isGroup) showGroupInfoFromContext(contextMenu.groupName);
                            else if (isNode) showNodeInfoFromContext(contextMenu.nodeId);
                            else if (isEdge) showEdgeInfoFromContext(contextMenu.edgeData.sourceId, contextMenu.edgeData.targetId);
                        }
                    }, [
                        React.createElement(Info, { key: 'icon', size: 14 }),
                        "Show Info"
                    ])
                ].filter(Boolean));  // Filter out false values from conditional rendering
            })(),

            // Info popup modal - supports single-panel (group/node/edge) or 3-panel (full) view
            infoPopup.open && React.createElement('div', {
                key: 'info-popup',
                className: "fixed z-50",
                style: {
                    left: infoPopupPos.x,
                    top: infoPopupPos.y,
                    // Use popup size directly (already set appropriately by the opener function)
                    width: infoPopupSize.width,
                    height: infoPopupSize.height
                },
                onMouseDown: handleInfoDragStart
            }, [
                // Main popup content
                React.createElement('div', {
                    key: 'modal-content',
                    className: "bg-white rounded-lg shadow-xl border border-gray-300 w-full h-full flex flex-col relative",
                    style: { cursor: infoDragging ? 'grabbing' : 'grab' }
                }, [
                    // X button (Cancel - restores original values)
                    React.createElement('button', {
                        key: 'close-x',
                        onClick: () => {
                            // Restore original values (Cancel)
                            const currentGroupName = nodes[infoPopup.nodeIndex]?.Group_xA;
                            const nodeIdx = infoPopup.nodeIndex;

                            setNodes(prev => {
                                const updated = prev.map(n => ({ ...n }));

                                if (infoPopup.type === 'group' && infoOriginal.groupName && currentGroupName !== infoOriginal.groupName) {
                                    // Restore group name for all nodes in this group
                                    updated.forEach((node, i) => {
                                        if (node.Group_xA === currentGroupName) {
                                            const currentID = node.ID_xA;
                                            updated[i].Group_xA = infoOriginal.groupName;
                                            updated[i].ID_xA = window.GraphApp.utils.generateID(infoOriginal.groupName, node.Node_xA);
                                            // Restore references that now point to the edited ID
                                            if (currentID && updated[i].ID_xA && currentID !== updated[i].ID_xA) {
                                                updated.forEach((refNode, j) => {
                                                    if (refNode.Linked_Node_ID_xA === currentID) {
                                                        updated[j].Linked_Node_ID_xA = updated[i].ID_xA;
                                                    }
                                                });
                                            }
                                        }
                                    });
                                    // Restore collapsedGroups if current name was collapsed
                                    if (collapsedGroups.has(currentGroupName)) {
                                        setCollapsedGroups(prev => {
                                            const newSet = new Set(prev);
                                            newSet.delete(currentGroupName);
                                            newSet.add(infoOriginal.groupName);
                                            return newSet;
                                        });
                                    }
                                    // Restore hiddenGroups if current name was hidden
                                    if (hiddenGroups.has(currentGroupName)) {
                                        setHiddenGroups(prev => {
                                            const newSet = new Set(prev);
                                            newSet.delete(currentGroupName);
                                            newSet.add(infoOriginal.groupName);
                                            return newSet;
                                        });
                                    }
                                }

                                if (infoPopup.type === 'node' && infoOriginal.nodeName !== undefined) {
                                    // Restore node name for this specific node
                                    const currentID = updated[nodeIdx]?.ID_xA;
                                    const originalID = window.GraphApp.utils.generateID(updated[nodeIdx]?.Group_xA, infoOriginal.nodeName);
                                    if (currentID !== originalID) {
                                        updated[nodeIdx].Node_xA = infoOriginal.nodeName;
                                        updated[nodeIdx].ID_xA = originalID;
                                        // Restore references
                                        if (currentID && originalID) {
                                            updated.forEach((refNode, j) => {
                                                if (refNode.Linked_Node_ID_xA === currentID) {
                                                    updated[j].Linked_Node_ID_xA = originalID;
                                                }
                                            });
                                        }
                                    }
                                }

                                // Restore info fields
                                updated.forEach((node, i) => {
                                    // Restore Group_Info for all nodes in the original group
                                    const targetGroupName = infoPopup.type === 'group' ? infoOriginal.groupName : currentGroupName;
                                    if (node.Group_xA === targetGroupName || node.Group_xA === currentGroupName) {
                                        updated[i].Group_Info = infoOriginal.groupInfo;
                                    }
                                    // Restore Node_Info and Link_Info for the specific node
                                    if (i === nodeIdx) {
                                        updated[i].Node_Info = infoOriginal.nodeInfo;
                                        updated[i].Link_Info = infoOriginal.linkInfo;
                                    }
                                });

                                return updated;
                            });

                            infoEditedRef.current = false;
                            setInfoPopup({ open: false, type: null, groupName: null, nodeIndex: null });
                        },
                        className: "absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded z-10",
                        title: "Cancel"
                    }, React.createElement(X, { size: 14 })),

                    // Panel grid - 1 column for single-panel views (group/node/edge), 3 columns for full view
                    React.createElement('div', {
                        key: 'panels',
                        className: (infoPopup.type === 'group' || infoPopup.type === 'node' || infoPopup.type === 'edge')
                            ? "p-4 flex-1 min-h-0 flex flex-col"
                            : "grid grid-cols-3 gap-3 p-4 flex-1 min-h-0"
                    }, infoPopup.type === 'group' ? (() => {
                        // Group-only view - with action buttons at top
                        const groupName = nodes[infoPopup.nodeIndex]?.Group_xA || '';
                        const linkedGroups = getLinkedGroups(groupName);
                        const hasLinkedGroups = linkedGroups.size > 0;

                        return [
                            // Action buttons row
                            React.createElement('div', {
                                key: 'action-buttons',
                                className: "flex gap-2 mb-3"
                            }, [
                                React.createElement('button', {
                                    key: 'show-linked',
                                    onClick: (e) => {
                                        e.stopPropagation();
                                        showLinkedGroupsFromPopup(groupName);
                                    },
                                    disabled: !hasLinkedGroups,
                                    className: hasLinkedGroups
                                        ? "px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 flex items-center gap-1"
                                        : "px-3 py-1.5 text-xs bg-gray-50 text-gray-400 border border-gray-200 rounded cursor-not-allowed flex items-center gap-1",
                                    style: { cursor: hasLinkedGroups ? 'pointer' : 'not-allowed' },
                                    title: hasLinkedGroups ? 'Unhide all groups that share links with this group' : 'No linked groups'
                                }, [
                                    React.createElement(Eye, { key: 'icon', size: 12 }),
                                    "Show Linked"
                                ]),
                                React.createElement('button', {
                                    key: 'show-only-linked',
                                    onClick: (e) => {
                                        e.stopPropagation();
                                        showOnlyLinkedGroupsFromPopup(groupName);
                                    },
                                    disabled: !hasLinkedGroups,
                                    className: hasLinkedGroups
                                        ? "px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 flex items-center gap-1"
                                        : "px-3 py-1.5 text-xs bg-gray-50 text-gray-400 border border-gray-200 rounded cursor-not-allowed flex items-center gap-1",
                                    style: { cursor: hasLinkedGroups ? 'pointer' : 'not-allowed' },
                                    title: hasLinkedGroups ? 'Hide all groups except this one and its linked groups' : 'No linked groups'
                                }, [
                                    React.createElement(EyeOff, { key: 'icon', size: 12 }),
                                    "Show ONLY Linked"
                                ]),
                                React.createElement('button', {
                                    key: 'hide-all-others',
                                    onClick: (e) => {
                                        e.stopPropagation();
                                        // Hide all groups except this one
                                        const allGroups = new Set(nodes.map(n => n.Group_xA).filter(Boolean));
                                        const newHidden = new Set();
                                        allGroups.forEach(g => {
                                            if (g !== groupName) {
                                                newHidden.add(g);
                                            }
                                        });
                                        setHiddenGroups(newHidden);
                                    },
                                    className: "px-3 py-1.5 text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded hover:bg-orange-100 flex items-center gap-1",
                                    style: { cursor: 'pointer' },
                                    title: 'Hide all other groups, show only this one'
                                }, [
                                    React.createElement(EyeOff, { key: 'icon', size: 12 }),
                                    "Hide Others"
                                ])
                            ]),
                            // Group Name label
                            React.createElement('label', {
                                key: 'group-label',
                                className: "text-xs text-gray-500 mb-1"
                            }, "Group Name"),
                            // Editable Group name input
                            React.createElement('input', {
                                key: 'group-name',
                                type: 'text',
                                className: "text-sm font-medium text-gray-800 mb-2 px-2 py-1 border border-gray-300 rounded w-full",
                                value: groupName,
                                onChange: (e) => {
                                    const newGroupName = e.target.value;
                                    const oldGroupName = groupName;
                                    infoEditedRef.current = true;
                                    // Update ALL nodes in this group with reference tracking
                                    setNodes(prev => {
                                        const updated = prev.map(n => ({ ...n }));
                                        updated.forEach((node, i) => {
                                            if (node.Group_xA === oldGroupName) {
                                                const oldID = node.ID_xA;
                                                updated[i].Group_xA = newGroupName;
                                                updated[i].ID_xA = window.GraphApp.utils.generateID(newGroupName, node.Node_xA);
                                                // Reference tracking - update Linked_Node_ID_xA that pointed to old ID
                                                if (oldID && updated[i].ID_xA && oldID !== updated[i].ID_xA) {
                                                    updated.forEach((refNode, j) => {
                                                        if (refNode.Linked_Node_ID_xA === oldID) {
                                                            updated[j].Linked_Node_ID_xA = updated[i].ID_xA;
                                                        }
                                                    });
                                                }
                                            }
                                        });
                                        return updated;
                                    });
                                    // Update collapsedGroups if old name was collapsed
                                    if (collapsedGroups.has(oldGroupName)) {
                                        setCollapsedGroups(prev => {
                                            const newSet = new Set(prev);
                                            newSet.delete(oldGroupName);
                                            newSet.add(newGroupName);
                                            return newSet;
                                        });
                                    }
                                    // Update hiddenGroups if old name was hidden
                                    if (hiddenGroups.has(oldGroupName)) {
                                        setHiddenGroups(prev => {
                                            const newSet = new Set(prev);
                                            newSet.delete(oldGroupName);
                                            newSet.add(newGroupName);
                                            return newSet;
                                        });
                                    }
                                }
                            }),
                            // Inconsistency warning if applicable
                            ...(groupInfoInconsistencies.has(groupName) ? [
                                React.createElement('div', {
                                    key: 'inconsistency-warning',
                                    className: "bg-red-100 text-red-700 px-2 py-1 rounded text-xs mb-2"
                                }, "Inconsistent values - editing will sync")
                            ] : []),
                            // Group Info label
                            React.createElement('label', {
                                key: 'group-info-label',
                                className: "text-xs text-gray-500 mb-1"
                            }, "Group Info"),
                            // Textarea
                            React.createElement('textarea', {
                                key: 'group-textarea',
                                className: "flex-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm resize-none min-h-0",
                                placeholder: 'Enter group description...',
                                style: { cursor: 'text' },
                                value: (() => {
                                    const firstNode = nodes.find(n => n.Group_xA === groupName);
                                    return firstNode?.Group_Info || '';
                                })(),
                                onChange: (e) => {
                                    const value = e.target.value;
                                    infoEditedRef.current = true;
                                    setNodes(prev => prev.map(node =>
                                        node.Group_xA === groupName
                                            ? { ...node, Group_Info: value }
                                            : node
                                    ));
                                }
                            })
                        ];
                    })() : infoPopup.type === 'node' ? (() => {
                        // Node-only view (right-click on node in canvas)
                        const nodeData = nodes[infoPopup.nodeIndex];
                        const nodeIndex = infoPopup.nodeIndex;
                        return [
                            // Group label (read-only)
                            React.createElement('div', {
                                key: 'node-group',
                                className: "text-xs text-gray-500 mb-2"
                            }, `Group: ${nodeData?.Group_xA || ''}`),
                            // Node Name label
                            React.createElement('label', {
                                key: 'node-name-label',
                                className: "text-xs text-gray-500 mb-1"
                            }, "Node Name"),
                            // Editable Node Name input
                            React.createElement('input', {
                                key: 'node-name',
                                type: 'text',
                                className: "text-sm font-medium text-gray-800 mb-2 px-2 py-1 border border-gray-300 rounded w-full",
                                value: nodeData?.Node_xA || '',
                                onChange: (e) => {
                                    const newNodeName = e.target.value;
                                    const oldID = nodeData?.ID_xA;
                                    const newID = window.GraphApp.utils.generateID(nodeData?.Group_xA, newNodeName);
                                    infoEditedRef.current = true;
                                    setNodes(prev => {
                                        const updated = prev.map(n => ({ ...n }));
                                        updated[nodeIndex].Node_xA = newNodeName;
                                        updated[nodeIndex].ID_xA = newID;
                                        // Reference tracking
                                        if (oldID && newID && oldID !== newID) {
                                            updated.forEach((refNode, j) => {
                                                if (refNode.Linked_Node_ID_xA === oldID) {
                                                    updated[j].Linked_Node_ID_xA = newID;
                                                }
                                            });
                                        }
                                        return updated;
                                    });
                                }
                            }),
                            // Node Info label
                            React.createElement('label', {
                                key: 'node-info-label',
                                className: "text-xs text-gray-500 mb-1"
                            }, "Node Info"),
                            // Node Info textarea
                            React.createElement('textarea', {
                                key: 'node-textarea',
                                className: "flex-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm resize-none min-h-0",
                                placeholder: 'Enter node notes...',
                                style: { cursor: 'text' },
                                value: nodeData?.Node_Info || '',
                                onChange: (e) => {
                                    const value = e.target.value;
                                    infoEditedRef.current = true;
                                    setNodes(prev => prev.map((node, i) =>
                                        i === nodeIndex
                                            ? { ...node, Node_Info: value }
                                            : node
                                    ));
                                }
                            })
                        ];
                    })() : infoPopup.type === 'edge' ? [
                        // Edge-only view (right-click on link in canvas)
                        React.createElement('label', {
                            key: 'link-label',
                            className: "text-xs text-gray-500 mb-1"
                        }, "Link Info"),
                        React.createElement('div', {
                            key: 'link-target',
                            className: "text-sm font-medium text-gray-800 mb-2 truncate",
                            title: nodes[infoPopup.nodeIndex]?.ID_xA + ' → ' + (nodes[infoPopup.nodeIndex]?.Linked_Node_ID_xA || '')
                        }, nodes[infoPopup.nodeIndex]?.ID_xA + ' → ' + (nodes[infoPopup.nodeIndex]?.Linked_Node_ID_xA || '')),
                        React.createElement('textarea', {
                            key: 'link-textarea',
                            className: "flex-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm resize-none min-h-0",
                            placeholder: 'Enter link notes...',
                            style: { cursor: 'text' },
                            value: nodes[infoPopup.nodeIndex]?.Link_Info || '',
                            onChange: (e) => {
                                const value = e.target.value;
                                infoEditedRef.current = true;
                                setNodes(prev => prev.map((node, i) =>
                                    i === infoPopup.nodeIndex
                                        ? { ...node, Link_Info: value }
                                        : node
                                ));
                            }
                        })
                    ] : [
                        // Full 3-panel view (expanded group)
                        // Left panel: Group Info
                        React.createElement('div', {
                            key: 'group-panel',
                            className: "flex flex-col min-h-0"
                        }, [
                            React.createElement('label', {
                                key: 'group-label',
                                className: "text-xs text-gray-500 mb-1"
                            }, "Group Info"),
                            React.createElement('div', {
                                key: 'group-name',
                                className: "text-sm font-medium text-gray-800 mb-2 truncate",
                                title: nodes[infoPopup.nodeIndex]?.Group_xA || ''
                            }, nodes[infoPopup.nodeIndex]?.Group_xA || ''),
                            // Warning about editing entire group
                            React.createElement('div', {
                                key: 'group-warning',
                                className: "bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs mb-2 border border-amber-200"
                            }, "Edits apply to entire group"),
                            // Inconsistency warning if applicable
                            ...(groupInfoInconsistencies.has(nodes[infoPopup.nodeIndex]?.Group_xA) ? [
                                React.createElement('div', {
                                    key: 'inconsistency-warning',
                                    className: "bg-red-100 text-red-700 px-2 py-1 rounded text-xs mb-2"
                                }, "Inconsistent values - editing will sync")
                            ] : []),
                            React.createElement('textarea', {
                                key: 'group-textarea',
                                className: "flex-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm resize-none min-h-0",
                                placeholder: 'Enter group description...',
                                style: { cursor: 'text' },
                                value: (() => {
                                    const groupName = nodes[infoPopup.nodeIndex]?.Group_xA;
                                    const firstNode = nodes.find(n => n.Group_xA === groupName);
                                    return firstNode?.Group_Info || '';
                                })(),
                                onChange: (e) => {
                                    const value = e.target.value;
                                    const groupName = nodes[infoPopup.nodeIndex]?.Group_xA;
                                    infoEditedRef.current = true;
                                    setNodes(prev => prev.map(node =>
                                        node.Group_xA === groupName
                                            ? { ...node, Group_Info: value }
                                            : node
                                    ));
                                }
                            })
                        ]),

                        // Middle panel: Node Info
                        React.createElement('div', {
                            key: 'node-panel',
                            className: "flex flex-col min-h-0"
                        }, [
                            React.createElement('label', {
                                key: 'node-label',
                                className: "text-xs text-gray-500 mb-1"
                            }, "Node Info"),
                            React.createElement('div', {
                                key: 'node-name',
                                className: "text-sm font-medium text-gray-800 mb-2 truncate",
                                title: nodes[infoPopup.nodeIndex]?.Node_xA || ''
                            }, nodes[infoPopup.nodeIndex]?.Node_xA || ''),
                            React.createElement('textarea', {
                                key: 'node-textarea',
                                className: "flex-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm resize-none min-h-0",
                                placeholder: 'Enter node notes...',
                                style: { cursor: 'text' },
                                value: nodes[infoPopup.nodeIndex]?.Node_Info || '',
                                onChange: (e) => {
                                    const value = e.target.value;
                                    infoEditedRef.current = true;
                                    setNodes(prev => prev.map((node, i) =>
                                        i === infoPopup.nodeIndex
                                            ? { ...node, Node_Info: value }
                                            : node
                                    ));
                                }
                            })
                        ]),

                        // Right panel: Link Info
                        React.createElement('div', {
                            key: 'link-panel',
                            className: "flex flex-col min-h-0"
                        }, [
                            React.createElement('label', {
                                key: 'link-label',
                                className: "text-xs text-gray-500 mb-1"
                            }, "Link Info"),
                            React.createElement('div', {
                                key: 'link-target',
                                className: "text-sm font-medium text-gray-800 mb-2 truncate",
                                title: nodes[infoPopup.nodeIndex]?.Linked_Node_ID_xA || 'No link'
                            }, nodes[infoPopup.nodeIndex]?.Linked_Node_ID_xA
                                ? `→ ${nodes[infoPopup.nodeIndex]?.Linked_Node_ID_xA}`
                                : '(no link)'
                            ),
                            React.createElement('textarea', {
                                key: 'link-textarea',
                                className: "flex-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm resize-none min-h-0",
                                placeholder: 'Enter link notes...',
                                style: { cursor: 'text' },
                                value: nodes[infoPopup.nodeIndex]?.Link_Info || '',
                                onChange: (e) => {
                                    const value = e.target.value;
                                    infoEditedRef.current = true;
                                    setNodes(prev => prev.map((node, i) =>
                                        i === infoPopup.nodeIndex
                                            ? { ...node, Link_Info: value }
                                            : node
                                    ));
                                }
                            })
                        ])
                    ]),

                    // Footer with Save/Cancel buttons
                    React.createElement('div', {
                        key: 'footer',
                        className: "flex justify-end gap-2 px-4 pb-3 pt-1"
                    }, [
                        React.createElement('button', {
                            key: 'cancel-btn',
                            onClick: () => {
                                // Restore original values (same logic as X button)
                                const currentGroupName = nodes[infoPopup.nodeIndex]?.Group_xA;
                                const nodeIdx = infoPopup.nodeIndex;

                                setNodes(prev => {
                                    const updated = prev.map(n => ({ ...n }));

                                    if (infoPopup.type === 'group' && infoOriginal.groupName && currentGroupName !== infoOriginal.groupName) {
                                        // Restore group name for all nodes in this group
                                        updated.forEach((node, i) => {
                                            if (node.Group_xA === currentGroupName) {
                                                const currentID = node.ID_xA;
                                                updated[i].Group_xA = infoOriginal.groupName;
                                                updated[i].ID_xA = window.GraphApp.utils.generateID(infoOriginal.groupName, node.Node_xA);
                                                // Restore references
                                                if (currentID && updated[i].ID_xA && currentID !== updated[i].ID_xA) {
                                                    updated.forEach((refNode, j) => {
                                                        if (refNode.Linked_Node_ID_xA === currentID) {
                                                            updated[j].Linked_Node_ID_xA = updated[i].ID_xA;
                                                        }
                                                    });
                                                }
                                            }
                                        });
                                        // Restore collapsedGroups if current name was collapsed
                                        if (collapsedGroups.has(currentGroupName)) {
                                            setCollapsedGroups(prev => {
                                                const newSet = new Set(prev);
                                                newSet.delete(currentGroupName);
                                                newSet.add(infoOriginal.groupName);
                                                return newSet;
                                            });
                                        }
                                        // Restore hiddenGroups if current name was hidden
                                        if (hiddenGroups.has(currentGroupName)) {
                                            setHiddenGroups(prev => {
                                                const newSet = new Set(prev);
                                                newSet.delete(currentGroupName);
                                                newSet.add(infoOriginal.groupName);
                                                return newSet;
                                            });
                                        }
                                    }

                                    if (infoPopup.type === 'node' && infoOriginal.nodeName !== undefined) {
                                        // Restore node name for this specific node
                                        const currentID = updated[nodeIdx]?.ID_xA;
                                        const originalID = window.GraphApp.utils.generateID(updated[nodeIdx]?.Group_xA, infoOriginal.nodeName);
                                        if (currentID !== originalID) {
                                            updated[nodeIdx].Node_xA = infoOriginal.nodeName;
                                            updated[nodeIdx].ID_xA = originalID;
                                            // Restore references
                                            if (currentID && originalID) {
                                                updated.forEach((refNode, j) => {
                                                    if (refNode.Linked_Node_ID_xA === currentID) {
                                                        updated[j].Linked_Node_ID_xA = originalID;
                                                    }
                                                });
                                            }
                                        }
                                    }

                                    // Restore info fields
                                    updated.forEach((node, i) => {
                                        const targetGroupName = infoPopup.type === 'group' ? infoOriginal.groupName : currentGroupName;
                                        if (node.Group_xA === targetGroupName || node.Group_xA === currentGroupName) {
                                            updated[i].Group_Info = infoOriginal.groupInfo;
                                        }
                                        if (i === nodeIdx) {
                                            updated[i].Node_Info = infoOriginal.nodeInfo;
                                            updated[i].Link_Info = infoOriginal.linkInfo;
                                        }
                                    });

                                    return updated;
                                });

                                infoEditedRef.current = false;
                                setInfoPopup({ open: false, type: null, groupName: null, nodeIndex: null });
                            },
                            className: "px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded",
                            style: { cursor: 'pointer' }
                        }, "Cancel"),
                        React.createElement('button', {
                            key: 'close-btn',
                            onClick: () => {
                                // Just close - keep changes but don't save to history
                                infoEditedRef.current = false;
                                setInfoPopup({ open: false, type: null, groupName: null, nodeIndex: null });
                            },
                            className: "px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded",
                            style: { cursor: 'pointer' }
                        }, "Close"),
                        React.createElement('button', {
                            key: 'save-btn',
                            onClick: () => {
                                // Save changes to history and close
                                if (infoEditedRef.current) {
                                    saveToHistory(nodes);
                                    infoEditedRef.current = false;
                                }
                                setInfoPopup({ open: false, type: null, groupName: null, nodeIndex: null });
                            },
                            className: "px-3 py-1.5 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded",
                            style: { cursor: 'pointer' }
                        }, "Save & Close")
                    ]),

                    // Resize handle (bottom-right corner)
                    React.createElement('div', {
                        key: 'resize-handle',
                        className: "absolute bottom-0 right-0 w-4 h-4 cursor-se-resize",
                        onMouseDown: (e) => {
                            e.stopPropagation();
                            setInfoResizing(true);
                        }
                    }, React.createElement('svg', {
                        className: "w-4 h-4 text-gray-400",
                        viewBox: "0 0 16 16",
                        fill: "currentColor"
                    }, React.createElement('path', {
                        d: "M14 14H10L14 10V14ZM14 8L8 14H6L14 6V8Z"
                    })))
                ])
            ]),

            // Settings modal
            showSettingsModal && React.createElement('div', {
                key: 'settings-modal',
                className: "fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center modal-overlay",
                onClick: () => setShowSettingsModal(false)
            }, React.createElement('div', {
                key: 'modal-content',
                className: "bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4",
                onClick: (e) => e.stopPropagation()
            }, [
                React.createElement('h3', {
                    key: 'title',
                    className: "text-lg font-semibold mb-4 text-gray-800"
                }, "AI Settings"),

                // API Key input
                React.createElement('div', { key: 'api-key-section', className: "mb-4" }, [
                    React.createElement('label', {
                        key: 'label',
                        className: "block text-sm font-medium text-gray-700 mb-1"
                    }, "Anthropic API Key"),
                    React.createElement('div', {
                        key: 'input-group',
                        className: "flex gap-2"
                    }, [
                        React.createElement('input', {
                            key: 'input',
                            type: 'password',
                            value: apiKey,
                            onChange: (e) => setApiKey(e.target.value),
                            placeholder: 'sk-ant-...',
                            className: "flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        }),
                        React.createElement('button', {
                            key: 'clear',
                            onClick: clearAPIKey,
                            className: "px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded border border-red-200",
                            title: "Clear API key"
                        }, "Clear")
                    ]),
                    React.createElement('p', {
                        key: 'help',
                        className: "mt-1 text-xs text-gray-500"
                    }, "Your key is stored locally in your browser. Never shared.")
                ]),

                // Model selector
                React.createElement('div', { key: 'model-section', className: "mb-4" }, [
                    React.createElement('label', {
                        key: 'label',
                        className: "block text-sm font-medium text-gray-700 mb-2"
                    }, "Model"),
                    React.createElement('div', {
                        key: 'options',
                        className: "space-y-2"
                    }, [
                        React.createElement('label', {
                            key: 'sonnet',
                            className: "flex items-center gap-2 cursor-pointer"
                        }, [
                            React.createElement('input', {
                                key: 'radio',
                                type: 'radio',
                                name: 'model',
                                checked: aiModel === 'claude-sonnet-4-5-20250929',
                                onChange: () => setAiModel('claude-sonnet-4-5-20250929'),
                                className: "text-blue-600"
                            }),
                            React.createElement('span', { key: 'text', className: "text-sm" }, "Sonnet 4.5"),
                            React.createElement('span', { key: 'desc', className: "text-xs text-gray-500" }, "(faster, cheaper)")
                        ]),
                        React.createElement('label', {
                            key: 'opus',
                            className: "flex items-center gap-2 cursor-pointer"
                        }, [
                            React.createElement('input', {
                                key: 'radio',
                                type: 'radio',
                                name: 'model',
                                checked: aiModel === 'claude-opus-4-5-20250929',
                                onChange: () => setAiModel('claude-opus-4-5-20250929'),
                                className: "text-blue-600"
                            }),
                            React.createElement('span', { key: 'text', className: "text-sm" }, "Opus 4.5"),
                            React.createElement('span', { key: 'desc', className: "text-xs text-gray-500" }, "(best quality)")
                        ])
                    ])
                ]),

                // AI Skill section
                React.createElement('div', { key: 'skill-section', className: "mb-4 pt-4 border-t border-gray-200" }, [
                    React.createElement('label', {
                        key: 'label',
                        className: "block text-sm font-medium text-gray-700 mb-2"
                    }, "AI Skill"),

                    // Current skill status
                    React.createElement('div', {
                        key: 'status',
                        className: "flex items-center gap-2 mb-2"
                    }, [
                        React.createElement('span', {
                            key: 'indicator',
                            className: "inline-block w-2 h-2 rounded-full " + (currentSkill.isCustom ? 'bg-green-500' : 'bg-gray-400')
                        }),
                        React.createElement('span', {
                            key: 'name',
                            className: "text-sm text-gray-600"
                        }, currentSkill.isCustom ? currentSkill.name : 'Default Skill'),
                        currentSkill.isCustom && React.createElement('span', {
                            key: 'custom-badge',
                            className: "text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded"
                        }, "Custom")
                    ]),

                    // Upload and Reset buttons
                    React.createElement('div', {
                        key: 'skill-buttons',
                        className: "flex gap-2"
                    }, [
                        // Hidden file input
                        React.createElement('input', {
                            key: 'file-input',
                            ref: skillInputRef,
                            type: 'file',
                            accept: '.md,.txt',
                            onChange: handleSkillUpload,
                            className: "hidden"
                        }),
                        // Upload button
                        React.createElement('button', {
                            key: 'upload',
                            onClick: () => skillInputRef.current && skillInputRef.current.click(),
                            className: "px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded border border-blue-200 flex items-center gap-1"
                        }, [
                            React.createElement(Upload, { key: 'icon', size: 14 }),
                            "Upload Skill"
                        ]),
                        // Reset button (only show if custom skill is active)
                        currentSkill.isCustom && React.createElement('button', {
                            key: 'reset',
                            onClick: resetToDefaultSkill,
                            className: "px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded border border-gray-200"
                        }, "Reset to Default")
                    ]),

                    // Help text
                    React.createElement('p', {
                        key: 'help',
                        className: "mt-2 text-xs text-gray-500"
                    }, "Upload a .md file with custom AI instructions. Must include {CONTEXT} placeholder.")
                ]),

                // Buttons
                React.createElement('div', {
                    key: 'buttons',
                    className: "flex gap-2 mt-6"
                }, [
                    React.createElement('button', {
                        key: 'cancel',
                        onClick: () => setShowSettingsModal(false),
                        className: "flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded"
                    }, "Cancel"),
                    React.createElement('button', {
                        key: 'save',
                        onClick: saveAPISettings,
                        className: "flex-1 px-4 py-2 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded"
                    }, "Save")
                ])
            ])),

            // AI Chat modal (draggable, resizable, no overlay)
            showAIModal && React.createElement('div', {
                key: 'ai-modal',
                className: "fixed z-50 bg-white rounded-lg shadow-2xl flex flex-col border border-gray-300",
                style: {
                    left: aiModalPos.x,
                    top: aiModalPos.y,
                    width: aiModalSize.width,
                    height: aiModalSize.height,
                    userSelect: aiDragging || aiResizing ? 'none' : 'auto'
                }
            }, [
                // Draggable Header
                React.createElement('div', {
                    key: 'header',
                    className: "flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg cursor-move",
                    onMouseDown: handleAiDragStart
                }, [
                    React.createElement('div', {
                        key: 'title-area',
                        className: "flex items-center gap-2"
                    }, [
                        React.createElement(Sparkles, { key: 'icon', size: 18, className: "text-purple-500" }),
                        React.createElement('span', { key: 'title', className: "font-semibold text-gray-800 text-sm" }, "AI Assistant")
                    ]),
                    React.createElement('div', {
                        key: 'header-buttons',
                        className: "flex items-center gap-2"
                    }, [
                        // Clear history button
                        aiConversation.length > 0 && React.createElement('button', {
                            key: 'clear-history',
                            onClick: () => setAiConversation([]),
                            className: "text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200",
                            title: "Clear conversation"
                        }, "Clear"),
                        // Close button
                        React.createElement('button', {
                            key: 'close',
                            onClick: () => { setShowAIModal(false); setAiError(''); },
                            className: "text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded",
                            title: "Close"
                        }, React.createElement(X, { size: 18 }))
                    ])
                ]),

                // Context badge
                React.createElement('div', {
                    key: 'context-badge',
                    className: "px-3 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between"
                }, [
                    React.createElement('span', {
                        key: 'context',
                        className: "text-xs text-gray-500"
                    }, nodes.length > 0
                        ? `${nodes.length} nodes, ${new Set(nodes.map(n => n.Group_xA)).size} groups`
                        : 'No graph - describe what to create'),
                    React.createElement('span', {
                        key: 'model',
                        className: "text-xs text-gray-400"
                    }, aiModel.includes('opus') ? 'Opus 4.5' : 'Sonnet 4.5')
                ]),

                // Conversation panel (scrollable)
                React.createElement('div', {
                    key: 'conversation',
                    className: "flex-1 overflow-y-auto p-3 space-y-2",
                    style: { minHeight: '100px' }
                }, aiConversation.length === 0
                    ? React.createElement('div', {
                        key: 'empty-state',
                        className: "text-center text-gray-400 py-6"
                    }, [
                        React.createElement('p', { key: 'line1', className: "mb-1 text-sm" }, "Start a conversation"),
                        React.createElement('p', { key: 'line2', className: "text-xs" }, '"Create a home network"'),
                        React.createElement('p', { key: 'line3', className: "text-xs" }, '"Add a printer"')
                    ])
                    : aiConversation.map((msg, idx) =>
                        React.createElement('div', {
                            key: `msg-${idx}`,
                            className: `flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`
                        }, React.createElement('div', {
                            className: `max-w-[85%] px-2.5 py-1.5 rounded-lg text-xs ${
                                msg.role === 'user'
                                    ? 'bg-purple-500 text-white'
                                    : msg.type === 'message'
                                        ? 'bg-gray-100 text-gray-800'
                                        : 'bg-green-50 text-green-800 border border-green-200'
                            }`
                        }, [
                            msg.role === 'assistant' && msg.type !== 'message' && React.createElement('span', {
                                key: 'badge',
                                className: "text-xs font-medium block mb-0.5 opacity-70"
                            }, msg.type === 'full' ? '📊 Generated' : '✏️ Modified'),
                            React.createElement('span', { key: 'content' }, msg.content)
                        ]))
                    )
                ),

                // Error display
                aiError && React.createElement('div', {
                    key: 'error',
                    className: "mx-3 mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700"
                }, aiError),

                // Input area
                React.createElement('div', {
                    key: 'input-area',
                    className: "p-3 border-t border-gray-200"
                }, [
                    React.createElement('div', {
                        key: 'input-row',
                        className: "flex gap-2"
                    }, [
                        React.createElement('textarea', {
                            key: 'textarea',
                            value: aiPrompt,
                            onChange: (e) => setAiPrompt(e.target.value),
                            onKeyDown: (e) => {
                                if (e.key === 'Enter' && !e.shiftKey && aiPrompt.trim() && !aiLoading) {
                                    e.preventDefault();
                                    generateFromAI();
                                }
                            },
                            placeholder: nodes.length > 0
                                ? "Ask a question or describe changes..."
                                : "Describe your diagram...",
                            rows: 2,
                            disabled: aiLoading,
                            className: "flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none disabled:bg-gray-100"
                        }),
                        React.createElement('button', {
                            key: 'send',
                            onClick: generateFromAI,
                            disabled: aiLoading || !aiPrompt.trim(),
                            className: "px-4 py-2 text-sm text-white bg-purple-500 hover:bg-purple-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center",
                            title: "Send (Enter)"
                        }, aiLoading
                            ? React.createElement('span', { className: "inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" })
                            : React.createElement(Send, { size: 18 })
                        )
                    ]),
                    React.createElement('p', {
                        key: 'hint',
                        className: "mt-1 text-xs text-gray-400"
                    }, "Enter to send · Drag header to move")
                ]),

                // Resize handle (bottom-right corner)
                React.createElement('div', {
                    key: 'resize-handle',
                    className: "absolute bottom-0 right-0 w-4 h-4 cursor-se-resize",
                    style: {
                        background: 'linear-gradient(135deg, transparent 50%, #9ca3af 50%)',
                        borderBottomRightRadius: '0.5rem'
                    },
                    onMouseDown: (e) => {
                        setAiResizing(true);
                        e.preventDefault();
                        e.stopPropagation();
                    }
                })
            ]),

            // ========== EVALUATION MODE OVERLAYS ==========

            // Evaluation control bar removed - Exit button now in stats bar
        ]);
    }

    // Mount app with error boundary
    window.addEventListener('DOMContentLoaded', () => {
        const container = document.getElementById('root');
        const root = ReactDOM.createRoot(container);
        const ErrorBoundary = window.GraphApp.components.ErrorBoundary;

        root.render(
            React.createElement(ErrorBoundary, null,
                React.createElement(SlimGraphApp)
            )
        );
    });

})(window);
