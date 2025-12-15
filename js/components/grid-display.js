/**
 * Grid Display Components
 *
 * Main interface for the grid-first architecture.
 * Contains: GridDisplay, GridCard, FilterPanel, Pagination
 */

(function(window) {
    'use strict';

    var createElement = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useMemo = React.useMemo;

    // Ensure namespace exists
    window.GraphApp = window.GraphApp || {};
    window.GraphApp.components = window.GraphApp.components || {};

    // Score button configurations (shared with evaluation-ui.js)
    // Colors used for both solid fill (selected) and outline text/border (unselected)
    var SCORE_CONFIG = {
        'N': { bg: '#6B7280', hoverBg: '#4B5563', color: '#FFFFFF', label: 'Skip' },  // Darker gray for outline visibility
        0: { bg: '#3B82F6', hoverBg: '#2563EB', color: '#FFFFFF', label: 'Tier 0' },
        1: { bg: '#3B82F6', hoverBg: '#2563EB', color: '#FFFFFF', label: 'Tier 1' },
        2: { bg: '#3B82F6', hoverBg: '#2563EB', color: '#FFFFFF', label: 'Tier 2' },
        3: { bg: '#3B82F6', hoverBg: '#2563EB', color: '#FFFFFF', label: 'Tier 3' }
    };

    // ========== FILTER FUNCTIONS ==========

    /**
     * Filter nodes by criteria
     * @param {Array} nodes - Nodes to filter
     * @param {Object} filters - Filter criteria
     * @param {Set} blockedRoots - Set of blocked root names (optional)
     */
    function filterNodes(nodes, filters, blockedRoots) {
        // Get helper functions from utils
        var countRoots = window.GraphApp.utils.countRoots;
        var getStatusFromRank = window.GraphApp.utils.getStatusFromRank;
        blockedRoots = blockedRoots || new Set();

        return nodes.filter(function(node) {
            // Rank filter
            var rank = node.Rank_xB;
            var isUnranked = rank === '' || rank === undefined || rank === null;
            var isTier0 = rank === 0;
            var isRanked = !isUnranked && !isTier0;

            // Check if this node is root-blocked (any root in blockedRoots)
            var isRootBlocked = blockedRoots.size > 0 && (
                blockedRoots.has(node.Root1_xB) ||
                blockedRoots.has(node.Root2_xB) ||
                blockedRoots.has(node.Root3_xB)
            );

            // Filter Matrix (Status × Root Count) - takes priority if defined
            if (filters.filterMatrix && Object.keys(filters.filterMatrix).length > 0) {
                var status = getStatusFromRank(rank);
                var rootCount = countRoots(node);
                var colKey = 'r' + rootCount;
                var matrixRow = filters.filterMatrix[status];

                // If the cell is unchecked, hide this node
                if (!matrixRow || !matrixRow[colKey]) {
                    return false;
                }

                // Root-blocked filter: three-state mode ('show' | 'only' | 'hide')
                var rootBlockedMode = filters.filterMatrix['rootblocked'] || 'show';
                if (rootBlockedMode === 'hide' && isRootBlocked) {
                    return false;  // Hide blocked candidates
                }
                if (rootBlockedMode === 'only' && !isRootBlocked) {
                    return false;  // Only show blocked candidates
                }
                // 'show' mode: include all (no filtering by root-blocked status)
            } else {
                // Legacy rank filter (only if matrix not used)
                if (filters.rankFilter === 'unranked' && !isUnranked) return false;
                if (filters.rankFilter === 'ranked' && !isRanked) return false;
                if (filters.rankFilter === 'blocked' && !isTier0) return false;
                if (filters.rankFilter === 'rank1' && rank !== 1) return false;
                if (filters.rankFilter === 'rank2' && rank !== 2) return false;
                if (filters.rankFilter === 'rank3' && rank !== 3) return false;
            }

            // Group filter (empty = all)
            if (filters.groupFilter && filters.groupFilter.length > 0) {
                if (!filters.groupFilter.includes(node.Group_xA)) return false;
            }

            // AI Score range
            var aiScore = node.AI_Rank_xB || 0;
            if (filters.aiScoreRange) {
                if (aiScore < filters.aiScoreRange[0] || aiScore > filters.aiScoreRange[1]) return false;
            }

            // Search text
            if (filters.searchText && filters.searchText.trim()) {
                var searchLower = filters.searchText.toLowerCase();
                var nodeName = (node.Node_xA || '').toLowerCase();
                if (!nodeName.includes(searchLower)) return false;
            }

            return true;
        });
    }

    /**
     * Sort nodes by grid filter criteria (different from table sort)
     */
    function sortGridNodes(nodes, sortBy) {
        var sorted = nodes.slice(); // Copy array
        switch (sortBy) {
            case 'ai-desc':
                return sorted.sort(function(a, b) { return (b.AI_Rank_xB || 0) - (a.AI_Rank_xB || 0); });
            case 'ai-asc':
                return sorted.sort(function(a, b) { return (a.AI_Rank_xB || 0) - (b.AI_Rank_xB || 0); });
            case 'alpha-asc':
                return sorted.sort(function(a, b) { return (a.Node_xA || '').localeCompare(b.Node_xA || ''); });
            case 'alpha-desc':
                return sorted.sort(function(a, b) { return (b.Node_xA || '').localeCompare(a.Node_xA || ''); });
            case 'random':
                return sorted.sort(function() { return Math.random() - 0.5; });
            default:
                return sorted;
        }
    }

    // ========== GRID CARD COMPONENT ==========

    /**
     * Individual card in the grid
     * Shows: name, group subtitle, rating buttons, roots, .com link
     * Supports fade animations for eval mode
     */
    function GridCard(props) {
        var node = props.node;
        var gridSize = props.gridSize || 3;
        var onScore = props.onScore;
        var onSkip = props.onSkip;
        var blockedRoots = props.blockedRoots || new Set();
        var onBlockRoot = props.onBlockRoot;
        var onUnblockRoot = props.onUnblockRoot;
        var countByRoot = props.countByRoot;
        var isExiting = props.isExiting || false;  // For fade-out animation
        var isEvalMode = props.isEvalMode || false; // For fade-in animation
        var compactView = props.compactView || false;
        var onEdit = props.onEdit;  // Callback: (nodeId, field, value) => void
        var dataFormat = props.dataFormat || 'candidates';  // 'roots' or 'candidates'

        var _hoverState = useState(-1);
        var hoveredScore = _hoverState[0];
        var setHoveredScore = _hoverState[1];

        var _rootHover = useState(null);
        var hoveredRoot = _rootHover[0];
        var setHoveredRoot = _rootHover[1];

        // Inline editing state
        var _editState = useState({ field: null, value: '' });
        var editState = _editState[0];
        var setEditState = _editState[1];

        // Editing handlers
        var startEdit = function(field, currentValue) {
            if (!onEdit) return;  // Don't allow editing if no handler
            setEditState({ field: field, value: currentValue !== undefined && currentValue !== null ? String(currentValue) : '' });
        };

        var saveEdit = function() {
            if (editState.field && onEdit) {
                var value = editState.value;
                // Parse numeric values for AI_Rank
                if (editState.field === 'AI_Rank_xB') {
                    value = value === '' ? '' : parseInt(value, 10);
                }
                onEdit(node.ID_xA, editState.field, value);
            }
            setEditState({ field: null, value: '' });
        };

        var cancelEdit = function() {
            setEditState({ field: null, value: '' });
        };

        var handleEditKeyDown = function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        };

        // Fade-in animation state (only in eval mode)
        var _mountedState = useState(!isEvalMode); // Start false in eval mode, true otherwise
        var mounted = _mountedState[0];
        var setMounted = _mountedState[1];

        // Trigger fade-in after mount (use requestAnimationFrame for reliable timing)
        useEffect(function() {
            if (isEvalMode && !mounted) {
                // Use double requestAnimationFrame to ensure browser has painted opacity:0 first
                var rafId = requestAnimationFrame(function() {
                    requestAnimationFrame(function() {
                        setMounted(true);
                    });
                });
                return function() { cancelAnimationFrame(rafId); };
            }
        }, [isEvalMode, mounted]);

        // Scale factor: 2×2 = 1.0, 8×8 = 0.5
        var scale = 1 - ((gridSize - 2) * 0.083);
        scale = Math.max(0.5, Math.min(1, scale)); // Clamp between 0.5 and 1

        // Calculate opacity for animations
        var opacity = isExiting ? 0 : (mounted ? 1 : 0);

        // Quick exit for blocked items (Rank_xB === 0), slower for others
        var isQuickExit = isExiting && node.Rank_xB === 0;

        // Collect roots (only non-empty)
        var roots = [];
        if (node.Root1_xB) roots.push(node.Root1_xB);
        if (node.Root2_xB) roots.push(node.Root2_xB);
        if (node.Root3_xB) roots.push(node.Root3_xB);

        // Current rank (used for toggle button selection state)
        var currentRank = node.Rank_xB;

        // Tier 0 detection: Rank_xB === 0 means user explicitly rejected this candidate
        var isTier0 = dataFormat === 'roots'
            ? (node.AI_Rank_xB === 0)
            : (currentRank === 0);

        // Root-blocked detection: any root in blockedRoots set (computed, not stored)
        var isRootBlocked = dataFormat === 'candidates' && roots.some(function(r) {
            return blockedRoots.has(r);
        });

        // Find which roots are blocked (for display)
        var blockedRootsList = roots.filter(function(r) { return blockedRoots.has(r); });

        // Diagonal strikethrough overlay for Tier 0 items
        var diagonalStrikeOverlay = isTier0 ? createElement('div', {
            style: {
                position: 'absolute',
                top: '50%',
                left: '-5%',
                width: '110%',
                height: '2px',
                backgroundColor: 'var(--text-muted)',
                transform: 'rotate(-12deg)',
                pointerEvents: 'none'
            }
        }) : null;

        // Root-blocked overlay: amber tint to indicate blocked by root (not by direct rating)
        var rootBlockedOverlay = isRootBlocked ? createElement('div', {
            style: {
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(245, 158, 11, 0.15)',  // Amber tint
                borderRadius: (12 * scale) + 'px',
                pointerEvents: 'none',
                zIndex: 1
            }
        }) : null;

        // Styles
        var containerStyle = {
            backgroundColor: 'var(--bg-primary)',
            borderRadius: (12 * scale) + 'px',
            boxShadow: '0 4px 20px var(--shadow-color)',
            border: isRootBlocked ? '2px solid #F59E0B' : '1px solid var(--border-primary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: (12 * scale) + 'px ' + (10 * scale) + 'px',
            boxSizing: 'border-box',
            overflow: 'hidden',
            position: 'relative',
            minHeight: 0,
            // Animation support
            opacity: opacity,
            transition: isEvalMode ? (isQuickExit ? 'opacity 0.3s ease-out' : 'opacity 2s ease-in-out') : 'none',
            pointerEvents: isExiting ? 'none' : 'auto'
        };

        var nameStyle = {
            fontSize: (22 * scale) + 'px',
            fontWeight: '700',
            textAlign: 'center',
            color: 'var(--text-primary)',
            marginBottom: (8 * scale) + 'px',
            lineHeight: '1.15',
            wordBreak: 'break-word',
            maxWidth: '100%'
        };

        var buttonRowStyle = {
            display: 'flex',
            gap: (4 * scale) + 'px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: (8 * scale) + 'px',
            width: '100%'
        };

        // Toggle button pattern: selected = solid fill, unselected = outline only
        var buttonStyle = function(scoreKey, isHovered, isSelected) {
            var config = SCORE_CONFIG[scoreKey];

            // Selected: solid fill. Unselected: outline only
            var bgColor, textColor, borderColor;
            if (isSelected) {
                bgColor = isHovered ? config.hoverBg : config.bg;
                textColor = config.color;
                borderColor = 'transparent';
            } else {
                bgColor = isHovered ? (config.bg + '20') : 'transparent'; // 20 = 12% opacity hex
                textColor = config.bg; // Use bg color as text color for outline style
                borderColor = config.bg;
            }

            return {
                padding: (4 * scale) + 'px ' + (8 * scale) + 'px',
                fontSize: (10 * scale) + 'px',
                fontWeight: '700',
                border: (2 * scale) + 'px solid ' + borderColor,
                borderRadius: (4 * scale) + 'px',
                backgroundColor: bgColor,
                color: textColor,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                minHeight: (24 * scale) + 'px',
                whiteSpace: 'nowrap'
            };
        };

        var rootsContainerStyle = {
            display: 'flex',
            gap: (12 * scale) + 'px',
            justifyContent: 'center',
            flex: 1,
            alignItems: 'center',
            flexWrap: 'wrap'
        };

        var rootItemStyle = {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: (2 * scale) + 'px'
        };

        var rootNameStyle = {
            fontSize: (12 * scale) + 'px',
            fontWeight: '600',
            color: 'var(--text-secondary)'
        };

        var blockRootBtnStyle = function(isHovered, isUnblockMode) {
            var bgColor = isUnblockMode
                ? (isHovered ? '#059669' : '#10B981')  // Green for unblock
                : (isHovered ? '#2563EB' : '#3B82F6'); // Blue for block
            return {
                fontSize: (8 * scale) + 'px',
                fontWeight: '500',
                padding: (2 * scale) + 'px ' + (5 * scale) + 'px',
                backgroundColor: bgColor,
                color: 'white',
                border: 'none',
                borderRadius: (3 * scale) + 'px',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
                textTransform: 'lowercase'
            };
        };

        var rootCountStyle = {
            fontSize: (10 * scale) + 'px',
            color: 'var(--text-muted)'
        };

        var comContainerStyle = {
            marginTop: 'auto',
            alignSelf: 'flex-end',
            paddingTop: (4 * scale) + 'px'
        };

        var comButtonStyle = {
            fontSize: (9 * scale) + 'px',
            fontWeight: '500',
            padding: (3 * scale) + 'px ' + (8 * scale) + 'px',
            backgroundColor: 'var(--bg-tertiary)',
            color: 'var(--text-muted)',
            border: 'none',
            borderRadius: (4 * scale) + 'px',
            cursor: 'pointer'
        };

        // ===== COMPACT VIEW: Name only, view-only mode =====
        if (compactView) {
            var compactStyle = {
                display: 'flex',
                alignItems: 'center',
                padding: (4 * scale) + 'px ' + (8 * scale) + 'px',
                borderRadius: (6 * scale) + 'px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                minHeight: (24 * scale) + 'px',
                opacity: isExiting ? 0 : (mounted ? 1 : 0),
                transition: isEvalMode ? 'opacity 2s ease-in-out' : 'none'
            };

            return createElement('div', { style: compactStyle },
                createElement('span', {
                    style: {
                        fontSize: (14 * scale) + 'px',
                        fontWeight: 'bold',
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        position: 'relative'
                    }
                }, node.Node_xA, diagonalStrikeOverlay)
            );
        }

        return createElement('div', { style: containerStyle },
            // Root-blocked overlay (amber tint)
            rootBlockedOverlay,

            // "Blocked by root" badge (top-right corner)
            isRootBlocked && createElement('div', {
                style: {
                    position: 'absolute',
                    top: (4 * scale) + 'px',
                    right: (4 * scale) + 'px',
                    fontSize: (8 * scale) + 'px',
                    backgroundColor: '#F59E0B',
                    color: '#FFFFFF',
                    padding: (2 * scale) + 'px ' + (4 * scale) + 'px',
                    borderRadius: (3 * scale) + 'px',
                    fontWeight: '600',
                    zIndex: 2
                },
                title: 'Blocked roots: ' + blockedRootsList.join(', ')
            }, 'ROOT'),

            // Name (at top - editable on click)
            editState.field === 'Node_xA'
                ? createElement('input', {
                    type: 'text',
                    value: editState.value,
                    onChange: function(e) { setEditState({ field: 'Node_xA', value: e.target.value }); },
                    onBlur: saveEdit,
                    onKeyDown: handleEditKeyDown,
                    autoFocus: true,
                    style: Object.assign({}, nameStyle, {
                        border: '2px solid var(--accent-primary)',
                        borderRadius: (4 * scale) + 'px',
                        padding: (2 * scale) + 'px ' + (6 * scale) + 'px',
                        width: '100%',
                        boxSizing: 'border-box',
                        outline: 'none',
                        backgroundColor: 'var(--bg-primary)'
                    })
                })
                : createElement('div', {
                    style: Object.assign({}, nameStyle, { cursor: onEdit ? 'pointer' : 'default', position: 'relative' }),
                    onClick: function() { startEdit('Node_xA', node.Node_xA); },
                    title: onEdit ? 'Click to edit' : ''
                }, node.Node_xA || '(unnamed)', diagonalStrikeOverlay),

            // AI Score / Engagement badge (editable on click)
            editState.field === 'AI_Rank_xB'
                ? createElement('input', {
                    type: 'number',
                    min: 0,
                    max: 100,
                    value: editState.value,
                    onChange: function(e) { setEditState({ field: 'AI_Rank_xB', value: e.target.value }); },
                    onBlur: saveEdit,
                    onKeyDown: handleEditKeyDown,
                    autoFocus: true,
                    style: {
                        fontSize: (10 * scale) + 'px',
                        width: (50 * scale) + 'px',
                        textAlign: 'center',
                        marginBottom: (6 * scale) + 'px',
                        border: '2px solid var(--accent-primary)',
                        borderRadius: (3 * scale) + 'px',
                        padding: (2 * scale) + 'px ' + (4 * scale) + 'px',
                        outline: 'none',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                    }
                })
                : createElement('div', {
                    style: {
                        fontSize: (10 * scale) + 'px',
                        color: 'var(--text-secondary)',
                        marginBottom: (6 * scale) + 'px',
                        cursor: onEdit ? 'pointer' : 'default',
                        backgroundColor: 'var(--bg-tertiary)',
                        padding: (2 * scale) + 'px ' + (8 * scale) + 'px',
                        borderRadius: (10 * scale) + 'px'
                    },
                    onClick: function() { startEdit('AI_Rank_xB', node.AI_Rank_xB); },
                    title: onEdit ? 'Click to edit score' : ''
                }, 'Score: ' + (node.AI_Rank_xB !== '' && node.AI_Rank_xB !== undefined && node.AI_Rank_xB !== null ? node.AI_Rank_xB : '-')),

            // Rating buttons: Different for roots vs candidates
            // Candidates: [Not rated] [Tier 0] [Tier 1] [Tier 2] [Tier 3]
            // Roots: [Block] only (sets AI_Rank to 0; edit score to unblock)
            dataFormat === 'candidates' ? createElement('div', { style: buttonRowStyle },
                createElement('button', {
                    key: 'N',
                    style: buttonStyle('N', hoveredScore === 'N', false),  // N is never selected (acts as "clear" action)
                    onClick: function() { onSkip && onSkip(node.ID_xA); },
                    onMouseEnter: function() { setHoveredScore('N'); },
                    onMouseLeave: function() { setHoveredScore(-1); },
                    title: 'Return to unrated'
                }, 'Not rated'),
                // Tier buttons: 0, 1, 2, 3 (Tier 0 = rejected/eliminated)
                [0, 1, 2, 3].map(function(score) {
                    return createElement('button', {
                        key: score,
                        style: buttonStyle(score, hoveredScore === score, currentRank === score),
                        onClick: function() { onScore && onScore(node.ID_xA, score); },
                        onMouseEnter: function() { setHoveredScore(score); },
                        onMouseLeave: function() { setHoveredScore(-1); },
                        title: SCORE_CONFIG[score].label + (score === 0 ? ' (rejected)' : '')
                    }, 'Tier ' + score);
                })
            ) : (
                // Root mode: Show Block button only if not already blocked (score > 0)
                node.AI_Rank_xB !== 0 && node.AI_Rank_xB !== '' && node.AI_Rank_xB !== null && node.AI_Rank_xB !== undefined
                    ? createElement('div', { style: buttonRowStyle },
                        createElement('button', {
                            key: 'block-root',
                            style: buttonStyle(0, hoveredScore === 0, false),
                            onClick: function() {
                                // Block by setting AI_Rank (engagement) to 0
                                onEdit && onEdit(node.ID_xA, 'AI_Rank_xB', 0);
                            },
                            onMouseEnter: function() { setHoveredScore(0); },
                            onMouseLeave: function() { setHoveredScore(-1); },
                            title: 'Block (set engagement to 0)'
                        }, 'Block')
                    )
                    : createElement('div', { style: Object.assign({}, buttonRowStyle, { minHeight: (24 * scale) + 'px' }) },
                        // Blocked indicator - click score badge to unblock
                        createElement('span', {
                            style: {
                                fontSize: (10 * scale) + 'px',
                                color: 'var(--text-muted)',
                                fontStyle: 'italic'
                            }
                        }, 'Blocked')
                    )
            ),

            // Roots section with block/unblock buttons and counts
            roots.length > 0 && createElement('div', { style: rootsContainerStyle },
                roots.map(function(root, index) {
                    var count = countByRoot ? countByRoot(root) : 0;
                    var isThisRootBlocked = blockedRoots.has(root);
                    // Strikethrough only for THIS root if it's blocked (not based on candidate Tier 0)
                    var rootStrikeOverlay = isThisRootBlocked ? createElement('div', {
                        style: {
                            position: 'absolute',
                            top: '50%',
                            left: '-5%',
                            width: '110%',
                            height: '1px',
                            backgroundColor: '#F59E0B',  // Amber to match root-blocked theme
                            transform: 'rotate(-12deg)',
                            pointerEvents: 'none'
                        }
                    }) : null;
                    return createElement('div', {
                        key: root + '-' + index,
                        style: rootItemStyle
                    },
                        createElement('span', { style: Object.assign({}, rootNameStyle, { position: 'relative' }) }, root, rootStrikeOverlay),
                        createElement('button', {
                            style: blockRootBtnStyle(hoveredRoot === root, isThisRootBlocked),
                            onClick: function() {
                                if (isThisRootBlocked) {
                                    // Unblock this root
                                    onUnblockRoot && onUnblockRoot(root);
                                } else {
                                    // Block this root
                                    onBlockRoot && onBlockRoot(root);
                                }
                            },
                            onMouseEnter: function() { setHoveredRoot(root); },
                            onMouseLeave: function() { setHoveredRoot(null); },
                            title: isThisRootBlocked
                                ? 'Unblock all with root "' + root + '"'
                                : 'Block all with root "' + root + '"'
                        }, isThisRootBlocked ? 'unblock' : 'block'),
                        createElement('span', { style: rootCountStyle }, '(' + count + ')')
                    );
                })
            ),

            // .com button
            createElement('div', { style: comContainerStyle },
                createElement('button', {
                    style: comButtonStyle,
                    onClick: function() {
                        var url = 'https://' + (node.Node_xA || '').toLowerCase().replace(/\s+/g, '') + '.com';
                        window.open(url, '_blank');
                    },
                    title: (node.Node_xA || '').toLowerCase().replace(/\s+/g, '') + '.com'
                }, '.com')
            )
        );
    }

    // ========== GRID DISPLAY COMPONENT ==========

    /**
     * Main grid display component
     * Uses CSS Grid to display cards
     * Supports eval mode with wave-based rendering and animations
     */
    function GridDisplay(props) {
        var nodes = props.nodes || [];
        var filters = props.filters || {};
        var gridSize = props.gridSize || 3;
        var currentPage = props.currentPage || 0;
        var onScore = props.onScore;
        var onSkip = props.onSkip;
        var blockedRoots = props.blockedRoots || new Set();
        var onBlockRoot = props.onBlockRoot;
        var onUnblockRoot = props.onUnblockRoot;
        var countByRoot = props.countByRoot;
        var isEvalSession = props.isEvalSession || false;
        var evalBatch = props.evalBatch || [];
        var evalExitingIds = props.evalExitingIds || new Set();
        var evalAllDone = props.evalAllDone || false;
        var evalRatedCount = props.evalRatedCount || 0;
        var compactView = props.compactView || false;
        var onEdit = props.onEdit;  // Callback for inline card editing
        var dataFormat = props.dataFormat || 'candidates';  // 'roots' or 'candidates'
        var onPageChange = props.onPageChange;  // Callback for page navigation

        // Filter and sort nodes (only used in non-eval mode)
        var filteredNodes = useMemo(function() {
            return filterNodes(nodes, filters, blockedRoots);
        }, [nodes, filters, blockedRoots]);

        var sortedNodes = useMemo(function() {
            return sortGridNodes(filteredNodes, filters.sortBy || 'ai-desc');
        }, [filteredNodes, filters.sortBy]);

        // Paginate (only used in non-eval mode)
        // In compact mode, show many more rows (gridSize * 20 instead of gridSize * gridSize)
        var pageSize = compactView ? gridSize * 20 : gridSize * gridSize;
        var startIndex = currentPage * pageSize;
        var pageNodes = sortedNodes.slice(startIndex, startIndex + pageSize);
        var totalPages = Math.ceil(sortedNodes.length / pageSize) || 1;
        var hasPrevPage = currentPage > 0;
        var hasNextPage = currentPage < totalPages - 1;

        // Container style
        var containerStyle = {
            flex: 1,
            padding: '16px',
            overflow: 'auto',
            backgroundColor: 'var(--bg-tertiary)',
            position: 'relative'  // For positioned arrow buttons
        };

        // Arrow button style
        var arrowButtonStyle = function(isLeft) {
            return {
                position: 'fixed',
                top: '50%',
                transform: 'translateY(-50%)',
                left: isLeft ? '240px' : 'auto',  // Account for 220px filter panel + padding
                right: isLeft ? 'auto' : '20px',
                width: '40px',
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-secondary)',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px var(--shadow-color)',
                fontSize: '24px',
                color: 'var(--text-secondary)',
                zIndex: 10,
                transition: 'all 0.15s ease'
            };
        };

        var emptyStyle = {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '300px',
            color: 'var(--text-muted)',
            fontSize: '16px'
        };

        var allDoneStyle = {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '300px',
            color: '#10B981',  // Keep semantic green
            fontSize: '24px',
            fontWeight: '700'
        };

        // ===== EVAL MODE: Wave-based rendering =====
        if (isEvalSession) {
            // Show "All Done!" message
            if (evalAllDone) {
                return createElement('div', { style: containerStyle },
                    createElement('div', { style: allDoneStyle },
                        createElement('div', null, '\u2705 All Done!'),
                        createElement('div', { style: { fontSize: '16px', color: 'var(--text-muted)', marginTop: '8px' } },
                            evalRatedCount + ' candidates rated'
                        )
                    )
                );
            }

            // Empty batch during wave transition
            if (evalBatch.length === 0) {
                return createElement('div', { style: containerStyle },
                    createElement('div', { style: emptyStyle }, 'Loading next wave...')
                );
            }

            // Eval grid: 3×3 fixed, cards positioned by gridRow/gridCol
            var evalGridStyle = {
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gridTemplateRows: 'repeat(3, 1fr)',
                gap: '12px',
                maxWidth: '900px',
                margin: '0 auto',
                minHeight: '600px'
            };

            // Create lookup for fresh node data (evalBatch has stale copies with grid positions)
            var nodesById = {};
            nodes.forEach(function(n) { nodesById[n.ID_xA] = n; });

            return createElement('div', { style: containerStyle },
                createElement('div', { style: evalGridStyle },
                    evalBatch.map(function(batchNode) {
                        var isExiting = evalExitingIds.has(batchNode.ID_xA);
                        // Merge fresh node data with grid position from batch
                        var freshNode = nodesById[batchNode.ID_xA] || batchNode;
                        var nodeWithPosition = Object.assign({}, freshNode, {
                            gridRow: batchNode.gridRow,
                            gridCol: batchNode.gridCol
                        });
                        // Position card in specific grid cell (CSS grid is 1-indexed)
                        var cardStyle = {
                            gridRow: (batchNode.gridRow !== undefined ? batchNode.gridRow + 1 : 'auto'),
                            gridColumn: (batchNode.gridCol !== undefined ? batchNode.gridCol + 1 : 'auto')
                        };
                        return createElement('div', { key: batchNode.ID_xA, style: cardStyle },
                            createElement(GridCard, {
                                node: nodeWithPosition,
                                gridSize: 3,  // Fixed size in eval mode
                                onScore: onScore,
                                onSkip: onSkip,
                                blockedRoots: blockedRoots,
                                onBlockRoot: onBlockRoot,
                                onUnblockRoot: onUnblockRoot,
                                countByRoot: countByRoot,
                                isExiting: isExiting,
                                isEvalMode: true,
                                compactView: compactView,
                                onEdit: onEdit,
                                dataFormat: dataFormat
                            })
                        );
                    })
                )
            );
        }

        // ===== NORMAL MODE: Pagination-based rendering =====
        var gridStyle = {
            display: 'grid',
            gridTemplateColumns: 'repeat(' + gridSize + ', 1fr)',
            gap: '12px',
            maxWidth: '1200px',
            margin: '0 auto'
        };

        if (pageNodes.length === 0) {
            return createElement('div', { style: containerStyle },
                createElement('div', { style: emptyStyle },
                    sortedNodes.length === 0 ? 'No candidates match the current filters' : 'No more candidates on this page'
                )
            );
        }

        return createElement('div', { style: containerStyle },
            // Left arrow (previous page)
            hasPrevPage && onPageChange && createElement('button', {
                key: 'arrow-left',
                style: arrowButtonStyle(true),
                onClick: function() { onPageChange(currentPage - 1); },
                title: 'Previous page'
            }, '\u25C0'),

            // Right arrow (next page)
            hasNextPage && onPageChange && createElement('button', {
                key: 'arrow-right',
                style: arrowButtonStyle(false),
                onClick: function() { onPageChange(currentPage + 1); },
                title: 'Next page'
            }, '\u25B6'),

            // Grid content
            createElement('div', { style: gridStyle },
                pageNodes.map(function(node) {
                    return createElement(GridCard, {
                        key: node.ID_xA,
                        node: node,
                        gridSize: gridSize,
                        onScore: onScore,
                        onSkip: onSkip,
                        blockedRoots: blockedRoots,
                        onBlockRoot: onBlockRoot,
                        onUnblockRoot: onUnblockRoot,
                        countByRoot: countByRoot,
                        isExiting: false,
                        isEvalMode: false,
                        compactView: compactView,
                        onEdit: onEdit,
                        dataFormat: dataFormat
                    });
                })
            )
        );
    }

    // ========== FILTER MATRIX COMPONENT ==========

    /**
     * 2D filter matrix for Status × Root Count filtering
     * Rows: Blocked (top), Unranked, Tier1, Tier2, Tier3
     * Columns: 1Root, 2Root, 3Root (dynamic based on data)
     * Full width layout with larger cells
     */
    function FilterMatrix(props) {
        var matrix = props.matrix || {};
        var setMatrix = props.setMatrix;
        var visibleColumns = props.visibleColumns || ['r1', 'r2', 'r3'];
        var isEvalSession = props.isEvalSession || false;
        var matrixCounts = props.matrixCounts || {};

        // Status rows (mutually exclusive - candidate is exactly ONE of these)
        var statusRows = ['tier1', 'tier2', 'tier3', 'blocked', 'unranked'];

        // Layer rows (orthogonal overlay - candidate can be any status AND be in this layer)
        var layerRows = ['rootblocked'];

        // All rows for display
        var allRows = statusRows.concat(layerRows);

        var rowLabels = { blocked: 'Tier 0', unranked: 'Unrated', tier1: 'Tier 1', tier2: 'Tier 2', tier3: 'Tier 3', rootblocked: 'Blocked' };
        var colLabels = { r1: '1 Root', r2: '2 Root', r3: '3 Root' };

        // Dynamic cell sizing to fill FilterPanel width (220px - 32px padding = 188px usable)
        var usableWidth = 188;
        var rowHeaderWidth = 52; // Width for row labels like "Tier 0", "Unrated"
        var gapSize = 3;
        var numCols = visibleColumns.length;
        var totalGaps = (numCols - 1) * gapSize;
        var cellSize = Math.floor((usableWidth - rowHeaderWidth - totalGaps) / numCols);  // ~43px for 3 cols
        var dataCellSize = Math.round(cellSize * 0.8);  // Data cells 20% smaller
        var dataCellHeight = Math.round(28 * 0.8);  // 22px - maintain aspect ratio

        // Check if all cells in a row are checked
        var isRowAllChecked = function(row) {
            return visibleColumns.every(function(col) {
                return matrix[row] && matrix[row][col];
            });
        };

        // Check if all STATUS cells in a column are checked (excludes layer rows)
        var isColAllChecked = function(col) {
            return statusRows.every(function(row) {
                return matrix[row] && matrix[row][col];
            });
        };

        // Check if all STATUS cells are checked (excludes layer rows)
        var isAllChecked = function() {
            return statusRows.every(function(row) {
                return visibleColumns.every(function(col) {
                    return matrix[row] && matrix[row][col];
                });
            });
        };

        // Toggle single cell
        var toggleCell = function(row, col) {
            if (isEvalSession) return;
            var newMatrix = JSON.parse(JSON.stringify(matrix));
            newMatrix[row] = newMatrix[row] || {};
            newMatrix[row][col] = !newMatrix[row][col];
            setMatrix(newMatrix);
        };

        // Toggle entire row
        var toggleRow = function(row) {
            if (isEvalSession) return;
            var allChecked = isRowAllChecked(row);
            var newMatrix = JSON.parse(JSON.stringify(matrix));
            newMatrix[row] = newMatrix[row] || {};
            visibleColumns.forEach(function(col) {
                newMatrix[row][col] = !allChecked;
            });
            setMatrix(newMatrix);
        };

        // Toggle entire column (STATUS rows only - excludes layer rows)
        var toggleCol = function(col) {
            if (isEvalSession) return;
            var allChecked = isColAllChecked(col);
            var newMatrix = JSON.parse(JSON.stringify(matrix));
            statusRows.forEach(function(row) {
                newMatrix[row] = newMatrix[row] || {};
                newMatrix[row][col] = !allChecked;
            });
            setMatrix(newMatrix);
        };

        // Toggle all (STATUS rows only - excludes layer rows)
        var toggleAll = function() {
            if (isEvalSession) return;
            var allChecked = isAllChecked();
            var newMatrix = JSON.parse(JSON.stringify(matrix));
            statusRows.forEach(function(row) {
                newMatrix[row] = newMatrix[row] || {};
                visibleColumns.forEach(function(col) {
                    newMatrix[row][col] = !allChecked;
                });
            });
            // Preserve layer row state (string modes, not objects)
            layerRows.forEach(function(row) {
                newMatrix[row] = matrix[row] || 'show';
            });
            setMatrix(newMatrix);
        };

        // Cycle layer row mode: show → only → hide → show
        var cycleLayerMode = function(row) {
            if (isEvalSession) return;
            var currentMode = matrix[row] || 'show';
            var modeOrder = ['show', 'only', 'hide'];
            var currentIndex = modeOrder.indexOf(currentMode);
            var nextIndex = (currentIndex + 1) % modeOrder.length;
            var newMatrix = JSON.parse(JSON.stringify(matrix));
            newMatrix[row] = modeOrder[nextIndex];
            setMatrix(newMatrix);
        };

        // Get layer mode label and description
        var getLayerModeInfo = function(mode) {
            switch (mode) {
                case 'only': return { label: 'Only', desc: 'Show ONLY root-blocked candidates' };
                case 'hide': return { label: 'Hide', desc: 'Hide root-blocked candidates' };
                default: return { label: 'Show', desc: 'Include root-blocked candidates' };
            }
        };

        // Styles - Full width layout
        var containerStyle = {
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            fontSize: '11px',
            width: '100%'
        };

        var rowStyle = {
            display: 'flex',
            gap: '3px',
            justifyContent: 'flex-start'
        };

        var headerCellStyle = function(isCorner, col) {
            // Boss buttons: static bg with blue border, no color change on toggle
            return {
                width: isCorner ? rowHeaderWidth + 'px' : cellSize + 'px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isEvalSession ? 'not-allowed' : 'pointer',
                backgroundColor: 'var(--bg-primary)',
                border: '2px solid var(--accent-primary)',
                borderRadius: '4px',
                color: 'var(--accent-primary)',
                fontWeight: '700',
                fontSize: '9px'
            };
        };

        var rowHeaderStyle = function(row) {
            var isLayer = layerRows.indexOf(row) !== -1;
            // Row boss buttons: static bg with blue border, no color change on toggle
            // Layer rows (like Blocked) use amber to distinguish from status rows
            return {
                width: rowHeaderWidth + 'px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isEvalSession ? 'not-allowed' : 'pointer',
                backgroundColor: isLayer ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-primary)',
                border: isLayer ? '2px solid #F59E0B' : '2px solid var(--accent-primary)',
                borderRadius: '4px',
                color: isLayer ? '#F59E0B' : 'var(--accent-primary)',
                fontWeight: '700',
                fontSize: '9px'
            };
        };

        var cellStyle = function(row, col) {
            var checked = matrix[row] && matrix[row][col];
            var count = matrixCounts[row] && matrixCounts[row][col] || 0;
            var hasData = count > 0;
            var isLayer = layerRows.indexOf(row) !== -1;

            // Layer rows use amber, status rows use blue
            var checkedColor = isLayer ? '#F59E0B' : 'var(--accent-primary)';
            var bgColor = checked ? checkedColor : (hasData ? 'var(--bg-primary)' : 'var(--bg-secondary)');
            var borderColor = checked ? checkedColor : 'var(--border-secondary)';
            var textColor = checked ? 'white' : 'var(--text-secondary)';

            // Data cells are 20% smaller than bosses to make headers pop
            return {
                width: dataCellSize + 'px',
                height: dataCellHeight + 'px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isEvalSession ? 'not-allowed' : 'pointer',
                backgroundColor: bgColor,
                border: '1px solid ' + borderColor,
                borderRadius: '3px',
                color: textColor,
                fontSize: '9px',
                fontWeight: '700',
                opacity: (checked || hasData) ? 1 : 0.5
            };
        };

        // Don't render if no columns visible
        if (visibleColumns.length === 0) {
            return null;
        }

        return createElement('div', { style: containerStyle },
            // Header row: corner + column headers
            createElement('div', { style: rowStyle },
                // Corner cell (toggle all) - "All" in slightly larger font
                createElement('div', {
                    style: Object.assign({}, headerCellStyle(true, null), { fontSize: '11px' }),
                    onClick: toggleAll,
                    title: 'Toggle all'
                }, 'All'),
                // Column headers
                visibleColumns.map(function(col) {
                    return createElement('div', {
                        key: col,
                        style: headerCellStyle(false, col),
                        onClick: function() { toggleCol(col); },
                        title: 'Toggle column: ' + colLabels[col]
                    }, colLabels[col]);
                })
            ),
            // Data rows: status rows first, then divider, then layer rows
            allRows.map(function(row, index) {
                var isFirstLayer = layerRows.indexOf(row) === 0;
                var isLayer = layerRows.indexOf(row) !== -1;
                var rowElements = [];

                // Add divider before first layer row
                if (isFirstLayer) {
                    rowElements.push(createElement('div', {
                        key: 'divider',
                        style: {
                            width: '100%',
                            height: '1px',
                            backgroundColor: '#F59E0B',
                            marginTop: '4px',
                            marginBottom: '4px',
                            opacity: 0.5
                        }
                    }));
                }

                // Layer rows get 3 separate mode buttons: Show | Only | Hide
                if (isLayer) {
                    var mode = matrix[row] || 'show';
                    // Total count for this layer row
                    var totalCount = visibleColumns.reduce(function(sum, col) {
                        return sum + (matrixCounts[row] && matrixCounts[row][col] || 0);
                    }, 0);

                    // Button style for each mode
                    var modeButtonStyle = function(btnMode) {
                        var isActive = mode === btnMode;
                        return {
                            padding: '4px 8px',
                            fontSize: '9px',
                            fontWeight: '700',
                            border: '2px solid #F59E0B',
                            borderRadius: '4px',
                            cursor: isEvalSession ? 'not-allowed' : 'pointer',
                            backgroundColor: isActive ? '#F59E0B' : 'transparent',
                            color: isActive ? 'white' : '#F59E0B'
                        };
                    };

                    // Set mode directly (not cycling)
                    var setMode = function(newMode) {
                        if (isEvalSession) return;
                        var newMatrix = JSON.parse(JSON.stringify(matrix));
                        newMatrix[row] = newMode;
                        setMatrix(newMatrix);
                    };

                    rowElements.push(createElement('div', { key: row, style: rowStyle },
                        // Row header - fixed width to align with status row headers
                        createElement('div', {
                            style: {
                                width: rowHeaderWidth + 'px',
                                fontSize: '10px',
                                fontWeight: '600',
                                color: '#F59E0B',
                                display: 'flex',
                                alignItems: 'center'
                            },
                            title: totalCount + ' root-blocked candidates'
                        }, rowLabels[row] + (totalCount > 0 ? ' (' + totalCount + ')' : '')),
                        // Three buttons aligned under matrix columns
                        createElement('div', {
                            style: {
                                display: 'flex',
                                gap: gapSize + 'px'
                            }
                        },
                            createElement('div', {
                                style: Object.assign({}, modeButtonStyle('show'), {
                                    width: cellSize + 'px',
                                    padding: '4px 0',
                                    textAlign: 'center',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }),
                                onClick: function() { setMode('show'); },
                                title: 'Include root-blocked candidates'
                            }, 'Show'),
                            createElement('div', {
                                style: Object.assign({}, modeButtonStyle('only'), {
                                    width: cellSize + 'px',
                                    padding: '4px 0',
                                    textAlign: 'center',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }),
                                onClick: function() { setMode('only'); },
                                title: 'Show ONLY root-blocked candidates'
                            }, 'Only'),
                            createElement('div', {
                                style: Object.assign({}, modeButtonStyle('hide'), {
                                    width: cellSize + 'px',
                                    padding: '4px 0',
                                    textAlign: 'center',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }),
                                onClick: function() { setMode('hide'); },
                                title: 'Hide root-blocked candidates'
                            }, 'Hide')
                        )
                    ));
                } else {
                    // Status rows get individual checkbox cells
                    rowElements.push(createElement('div', { key: row, style: rowStyle },
                        // Row header
                        createElement('div', {
                            style: rowHeaderStyle(row),
                            onClick: function() { toggleRow(row); },
                            title: 'Toggle row: ' + rowLabels[row]
                        }, rowLabels[row]),
                        // Cells - wrapped in container for centering smaller cells
                        visibleColumns.map(function(col) {
                            var count = matrixCounts[row] && matrixCounts[row][col] || 0;
                            return createElement('div', {
                                key: col,
                                style: {
                                    width: cellSize + 'px',
                                    height: '28px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }
                            },
                                createElement('div', {
                                    style: cellStyle(row, col),
                                    onClick: function() { toggleCell(row, col); },
                                    title: rowLabels[row] + ' + ' + colLabels[col] + ': ' + count + ' items'
                                }, count > 0 ? count : '·')
                            );
                        })
                    ));
                }

                return rowElements;
            })
        );
    }

    // ========== CLASS FILTER COMPONENT (Root Mode) ==========

    /**
     * Class filter for Root mode
     * Shows Group_xA values as toggle buttons in a 2-column grid
     * Includes Show All / Hide All buttons
     */
    function TerritoryMatrix(props) {
        var territories = props.territories || [];      // Array of class names (Group_xA)
        var selectedTerritories = props.selected || new Set();  // Which are selected
        var onToggle = props.onToggle;                  // Toggle callback
        var onShowAll = props.onShowAll;                // Select all callback
        var onHideAll = props.onHideAll;                // Deselect all callback
        var counts = props.counts || {};                // Count per class

        var containerStyle = {
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
        };

        // Control buttons row style
        var controlRowStyle = {
            display: 'flex',
            gap: '4px',
            marginBottom: '4px'
        };

        var controlBtnStyle = {
            flex: 1,
            padding: '5px 8px',
            fontSize: '10px',
            fontWeight: '600',
            borderRadius: '4px',
            border: '1px solid var(--border-secondary)',
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: 'var(--text-secondary)',
            textAlign: 'center'
        };

        // 2 columns wide, wrapping
        var gridStyle = {
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '4px'
        };

        var buttonStyle = function(territory, isSelected) {
            return {
                padding: '6px 8px',
                fontSize: '11px',
                fontWeight: '500',
                borderRadius: '4px',
                border: '1px solid ' + (isSelected ? 'var(--accent-primary)' : 'var(--border-secondary)'),
                cursor: 'pointer',
                backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-primary)',
                color: isSelected ? 'white' : 'var(--text-secondary)',
                textAlign: 'left',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
            };
        };

        return createElement('div', { style: containerStyle },
            // Show All / Hide All buttons
            createElement('div', { style: controlRowStyle },
                createElement('button', {
                    style: controlBtnStyle,
                    onClick: onShowAll,
                    title: 'Select all classes'
                }, 'Show All'),
                createElement('button', {
                    style: controlBtnStyle,
                    onClick: onHideAll,
                    title: 'Deselect all classes'
                }, 'Hide All')
            ),
            // Class buttons grid
            createElement('div', { style: gridStyle },
                territories.map(function(territory) {
                    var isSelected = selectedTerritories.has(territory);
                    var count = counts[territory] || 0;
                    return createElement('button', {
                        key: territory,
                        style: buttonStyle(territory, isSelected),
                        onClick: function() { onToggle && onToggle(territory); },
                        title: territory + ': ' + count + ' items'
                    }, territory);
                })
            )
        );
    }

    // ========== FILTER PANEL COMPONENT ==========

    /**
     * Left sidebar with filter controls
     */
    function FilterPanel(props) {
        var filters = props.filters || {};
        var setFilters = props.setFilters;
        var gridSize = props.gridSize || 3;
        var setGridSize = props.setGridSize;
        var groups = props.groups || [];
        var groupCounts = props.groupCounts || {};
        var stats = props.stats || {};
        var isEvalSession = props.isEvalSession;
        var onStartEval = props.onStartEval;
        var onExitEval = props.onExitEval;
        var filteredCount = props.filteredCount || 0;
        var totalCount = props.totalCount || 0;
        var evalRatedCount = props.evalRatedCount || 0;
        // Pagination props
        var currentPage = props.currentPage || 0;
        var totalPages = props.totalPages || 1;
        var onPageChange = props.onPageChange;
        var pageSize = props.pageSize || 9;
        // Filter matrix props
        var filterMatrix = props.filterMatrix || {};
        var setFilterMatrix = props.setFilterMatrix;
        var visibleColumns = props.visibleColumns || [];
        var matrixCounts = props.matrixCounts || {};
        // Compact view props
        var compactView = props.compactView || false;
        var setCompactView = props.setCompactView;
        // Add node handler
        var onAddNode = props.onAddNode;
        // Class filter props (root mode)
        var dataFormat = props.dataFormat || 'candidates';
        var selectedTerritories = props.selectedTerritories || new Set();
        var onToggleTerritory = props.onToggleTerritory;
        var onShowAllClasses = props.onShowAllClasses;
        var onHideAllClasses = props.onHideAllClasses;
        // Show/hide blocked roots props
        var showBlockedRoots = props.showBlockedRoots !== undefined ? props.showBlockedRoots : true;
        var setShowBlockedRoots = props.setShowBlockedRoots;

        var panelStyle = {
            width: '220px',
            backgroundColor: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border-primary)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto',
            flexShrink: 0
        };

        var sectionStyle = {
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
        };

        var labelStyle = {
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
        };

        // Update filter helper
        var updateFilter = function(key, value) {
            if (isEvalSession) return;
            setFilters(Object.assign({}, filters, { [key]: value }));
        };

        // Calculate pagination display values
        var pageStart = filteredCount > 0 ? currentPage * pageSize + 1 : 0;
        var pageEnd = Math.min((currentPage + 1) * pageSize, filteredCount);

        var paginationButtonStyle = function(disabled) {
            return {
                padding: '4px 8px',
                border: '1px solid var(--border-secondary)',
                borderRadius: '4px',
                backgroundColor: disabled ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                color: disabled ? 'var(--text-faint)' : 'var(--text-secondary)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                fontSize: '12px'
            };
        };

        return createElement('div', { style: panelStyle },
            // Stats summary (different display for eval mode)
            isEvalSession ? createElement('div', { style: { padding: '10px', backgroundColor: '#FEF3C7', borderRadius: '6px', fontSize: '12px', border: '1px solid #F59E0B' } },
                createElement('div', { style: { fontWeight: '700', color: '#92400E', marginBottom: '4px' } }, '\u26A1 Eval Session'),
                createElement('div', { style: { color: '#78350F' } }, 'Rated: ' + evalRatedCount),
                createElement('div', { style: { color: '#78350F' } }, 'Remaining: ' + (stats.unranked || 0))
            ) : createElement('div', { style: { padding: '10px', backgroundColor: 'var(--border-primary)', borderRadius: '6px', fontSize: '12px' } },
                // Pagination controls in normal mode
                createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
                    createElement('button', {
                        onClick: function() { onPageChange && onPageChange(currentPage - 1); },
                        disabled: currentPage === 0,
                        style: paginationButtonStyle(currentPage === 0)
                    }, '\u25C0'),
                    createElement('span', { style: { fontWeight: '600', color: 'var(--text-secondary)' } },
                        filteredCount > 0 ? (pageStart + '-' + pageEnd + ' of ' + filteredCount) : '0'
                    ),
                    createElement('button', {
                        onClick: function() { onPageChange && onPageChange(currentPage + 1); },
                        disabled: currentPage >= totalPages - 1,
                        style: paginationButtonStyle(currentPage >= totalPages - 1)
                    }, '\u25B6')
                )
            ),

            // Add new item/root button (text changes based on mode)
            onAddNode && createElement('div', { style: { marginTop: '12px', marginBottom: '8px' } },
                createElement('button', {
                    onClick: onAddNode,
                    style: {
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: 'var(--accent-primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                    },
                    title: dataFormat === 'roots' ? 'Add new root to selected class' : 'Add new item'
                }, [
                    createElement('span', { key: 'plus', style: { fontSize: '16px' } }, '+'),
                    createElement('span', { key: 'text' }, dataFormat === 'roots' ? 'Add Root' : 'Add Item')
                ])
            ),

            // Grid Size selector - full width matching FilterMatrix (43px cells)
            createElement('div', { style: sectionStyle },
                createElement('div', { style: labelStyle }, 'Grid Size'),
                // 3x3 grid using same cell size as FilterMatrix
                createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 43px)', gap: '3px' } },
                    [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function(size) {
                        var isSelected = gridSize === size;
                        return createElement('button', {
                            key: size,
                            onClick: function() { !isEvalSession && setGridSize(size); },
                            disabled: isEvalSession,
                            style: {
                                width: '43px',
                                height: '28px',
                                border: '1px solid ' + (isSelected ? 'var(--accent-primary)' : 'var(--border-secondary)'),
                                borderRadius: '4px',
                                backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-primary)',
                                color: isSelected ? 'white' : 'var(--text-secondary)',
                                cursor: isEvalSession ? 'not-allowed' : 'pointer',
                                fontWeight: '700',
                                fontSize: '10px'
                            }
                        }, size);
                    })
                ),
                // Compact toggle button - full width below grid
                createElement('button', {
                    onClick: function() { setCompactView && setCompactView(!compactView); },
                    title: 'Compact view - names only',
                    style: {
                        marginTop: '8px',
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        border: '1px solid ' + (compactView ? 'var(--accent-primary)' : 'var(--border-secondary)'),
                        backgroundColor: compactView ? 'var(--accent-primary)' : 'var(--bg-primary)',
                        color: compactView ? 'white' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '11px'
                    }
                }, 'Compact')
            ),

            // Filter section: TerritoryMatrix for roots mode, FilterMatrix for candidates mode
            dataFormat === 'roots' ?
                // Root mode: Class filter (2-column grid of Group_xA values) + Show Blocked toggle
                groups.length > 0 && createElement('div', { style: sectionStyle },
                    createElement('div', { style: labelStyle }, 'CLASS'),
                    createElement(TerritoryMatrix, {
                        territories: groups,
                        selected: selectedTerritories,
                        onToggle: onToggleTerritory,
                        onShowAll: onShowAllClasses,
                        onHideAll: onHideAllClasses,
                        counts: groupCounts
                    }),
                    // Show/Hide Blocked toggle
                    createElement('div', {
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginTop: '12px',
                            paddingTop: '8px',
                            borderTop: '1px solid var(--border-secondary)'
                        }
                    },
                        createElement('input', {
                            type: 'checkbox',
                            id: 'show-blocked-roots',
                            checked: showBlockedRoots,
                            onChange: function() { setShowBlockedRoots && setShowBlockedRoots(!showBlockedRoots); },
                            style: { cursor: 'pointer' }
                        }),
                        createElement('label', {
                            htmlFor: 'show-blocked-roots',
                            style: {
                                fontSize: '11px',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer'
                            }
                        }, 'Show Blocked')
                    )
                ) :
                // Candidates mode: Filter Matrix (Status × Root Count)
                visibleColumns.length > 0 && createElement('div', { style: sectionStyle },
                    createElement('div', { style: labelStyle }, 'SHOW'),
                    createElement(FilterMatrix, {
                        matrix: filterMatrix,
                        setMatrix: setFilterMatrix,
                        visibleColumns: visibleColumns,
                        isEvalSession: isEvalSession,
                        matrixCounts: matrixCounts
                    })
                ),

            // Sort selector
            createElement('div', { style: sectionStyle },
                createElement('div', { style: labelStyle }, 'Sort By'),
                createElement('select', {
                    value: filters.sortBy || 'ai-desc',
                    onChange: function(e) { updateFilter('sortBy', e.target.value); },
                    disabled: isEvalSession,
                    style: {
                        padding: '6px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-secondary)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-secondary)',
                        cursor: isEvalSession ? 'not-allowed' : 'pointer'
                    }
                },
                    createElement('option', { value: 'ai-desc' }, 'AI Score \u2193'),
                    createElement('option', { value: 'ai-asc' }, 'AI Score \u2191'),
                    createElement('option', { value: 'alpha-asc' }, 'A \u2192 Z'),
                    createElement('option', { value: 'alpha-desc' }, 'Z \u2192 A'),
                    createElement('option', { value: 'random' }, 'Random')
                )
            ),

            // Search box
            createElement('div', { style: sectionStyle },
                createElement('div', { style: labelStyle }, 'Search'),
                createElement('input', {
                    type: 'text',
                    value: filters.searchText || '',
                    onChange: function(e) { updateFilter('searchText', e.target.value); },
                    disabled: isEvalSession,
                    placeholder: 'Filter by name...',
                    style: {
                        padding: '6px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-secondary)',
                        backgroundColor: isEvalSession ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                        color: 'var(--text-primary)'
                    }
                })
            ),

            // Spacer
            createElement('div', { style: { flex: 1 } }),

            // Eval session button
            isEvalSession ?
                createElement('button', {
                    onClick: onExitEval,
                    style: {
                        padding: '12px',
                        backgroundColor: '#EF4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '14px'
                    }
                }, 'Exit Eval Session') :
                createElement('button', {
                    onClick: onStartEval,
                    style: {
                        padding: '12px',
                        backgroundColor: '#3B82F6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '14px'
                    }
                }, 'Start Eval Session')
        );
    }

    // ========== PAGINATION COMPONENT ==========

    /**
     * Pagination controls at bottom of grid
     */
    function Pagination(props) {
        var currentPage = props.currentPage || 0;
        var totalPages = props.totalPages || 1;
        var onPageChange = props.onPageChange;
        var filteredCount = props.filteredCount || 0;
        var pageSize = props.pageSize || 9;

        var start = filteredCount > 0 ? currentPage * pageSize + 1 : 0;
        var end = Math.min((currentPage + 1) * pageSize, filteredCount);

        var containerStyle = {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            padding: '12px',
            borderTop: '1px solid var(--border-primary)',
            backgroundColor: 'var(--bg-primary)'
        };

        var buttonStyle = function(disabled) {
            return {
                padding: '8px 16px',
                border: '1px solid var(--border-secondary)',
                borderRadius: '4px',
                backgroundColor: disabled ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                color: disabled ? 'var(--text-faint)' : 'var(--text-secondary)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontWeight: '500'
            };
        };

        var infoStyle = {
            color: 'var(--text-secondary)',
            fontSize: '14px'
        };

        return createElement('div', { style: containerStyle },
            createElement('button', {
                onClick: function() { onPageChange(currentPage - 1); },
                disabled: currentPage === 0,
                style: buttonStyle(currentPage === 0)
            }, '\u25C0 Prev'),

            createElement('span', { style: infoStyle },
                filteredCount > 0 ? (start + '-' + end + ' of ' + filteredCount) : 'No results'
            ),

            createElement('button', {
                onClick: function() { onPageChange(currentPage + 1); },
                disabled: currentPage >= totalPages - 1,
                style: buttonStyle(currentPage >= totalPages - 1)
            }, 'Next \u25B6')
        );
    }

    // ========== EXPORTS ==========

    // Export filter functions to utils (use unique names to avoid colliding with utils.js)
    window.GraphApp.utils = window.GraphApp.utils || {};
    window.GraphApp.utils.filterGridNodes = filterNodes;
    window.GraphApp.utils.sortGridNodes = sortGridNodes;

    // Export components
    window.GraphApp.components.GridCard = GridCard;
    window.GraphApp.components.GridDisplay = GridDisplay;
    window.GraphApp.components.FilterPanel = FilterPanel;
    window.GraphApp.components.FilterMatrix = FilterMatrix;
    window.GraphApp.components.Pagination = Pagination;

})(window);
