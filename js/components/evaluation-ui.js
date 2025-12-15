/**
 * Evaluation UI Components
 *
 * React components for evaluation mode overlay.
 * Renders candidate cards with score buttons positioned over the canvas.
 */

(function(window) {
    'use strict';

    var createElement = React.createElement;
    var useState = React.useState;
    var useEffect = React.useEffect;
    var useCallback = React.useCallback;

    // Ensure namespace exists
    window.GraphApp = window.GraphApp || {};
    window.GraphApp.components = window.GraphApp.components || {};

    // Score button configurations
    var SCORE_CONFIG = {
        'N': { bg: '#9CA3AF', hoverBg: '#6B7280', color: '#FFFFFF', label: 'Skip' },
        0: { bg: '#EF4444', hoverBg: '#DC2626', color: '#FFFFFF', label: 'Block' },
        1: { bg: '#3B82F6', hoverBg: '#2563EB', color: '#FFFFFF', label: 'Tier 1' },
        2: { bg: '#3B82F6', hoverBg: '#2563EB', color: '#FFFFFF', label: 'Tier 2' },
        3: { bg: '#3B82F6', hoverBg: '#2563EB', color: '#FFFFFF', label: 'Tier 3' }
    };

    /**
     * Individual Score Button
     */
    function ScoreButton(props) {
        var score = props.score;
        var onClick = props.onClick;
        var disabled = props.disabled;

        var _useState = useState(false);
        var hover = _useState[0];
        var setHover = _useState[1];

        var config = SCORE_CONFIG[score];

        var style = {
            flex: 1,
            padding: '8px 4px',
            fontSize: '14px',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: hover && !disabled ? config.hoverBg : config.bg,
            color: config.color,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            transition: 'background-color 0.15s, transform 0.1s',
            transform: hover && !disabled ? 'scale(1.05)' : 'scale(1)'
        };

        return createElement('button', {
            style: style,
            onClick: disabled ? null : onClick,
            onMouseEnter: function() { setHover(true); },
            onMouseLeave: function() { setHover(false); },
            title: config.label,
            disabled: disabled
        }, score);
    }

    /**
     * Candidate Card Component
     * Displays name, AI rank, and score buttons
     */
    function CandidateCard(props) {
        var candidate = props.candidate;
        var position = props.position;
        var onScore = props.onScore;
        var onSkip = props.onSkip;
        var isExiting = props.isExiting;

        var _useState2 = useState(false);
        var isHovered = _useState2[0];
        var setIsHovered = _useState2[1];

        var cardStyle = {
            position: 'absolute',
            left: position.x,
            top: position.y,
            transform: 'translate(-50%, -50%)',
            width: '160px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            boxShadow: isHovered
                ? '0 8px 24px rgba(0,0,0,0.2)'
                : '0 4px 12px rgba(0,0,0,0.1)',
            padding: '16px',
            zIndex: 100,
            transition: 'box-shadow 0.2s, opacity 0.3s, transform 0.3s',
            opacity: isExiting ? 0 : 1,
            pointerEvents: isExiting ? 'none' : 'auto'
        };

        var nameStyle = {
            fontSize: '16px',
            fontWeight: '600',
            textAlign: 'center',
            marginBottom: '4px',
            color: '#1F2937',
            lineHeight: '1.2',
            wordBreak: 'break-word'
        };

        var aiRankStyle = {
            fontSize: '11px',
            color: '#6B7280',
            textAlign: 'center',
            marginBottom: '12px'
        };

        var buttonRowStyle = {
            display: 'flex',
            gap: '6px',
            marginBottom: '8px'
        };

        var skipStyle = {
            width: '100%',
            padding: '6px',
            fontSize: '11px',
            border: '1px dashed #CBD5E1',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            color: '#64748B',
            cursor: isExiting ? 'not-allowed' : 'pointer',
            transition: 'border-color 0.15s, color 0.15s'
        };

        return createElement('div', {
            style: cardStyle,
            onMouseEnter: function() { setIsHovered(true); },
            onMouseLeave: function() { setIsHovered(false); }
        },
            createElement('div', { style: nameStyle }, candidate.Node_xA || 'Unnamed'),
            createElement('div', { style: aiRankStyle },
                'AI Score: ' + (candidate.AI_Rank || '\u2014')
            ),
            createElement('div', { style: buttonRowStyle },
                [0, 1, 2, 3].map(function(score) {
                    return createElement(ScoreButton, {
                        key: score,
                        score: score,
                        onClick: function() { onScore(candidate.ID_xA, score); },
                        disabled: isExiting
                    });
                })
            ),
            createElement('button', {
                style: skipStyle,
                onClick: function() { onSkip(candidate.ID_xA); },
                disabled: isExiting
            }, '? Skip for later')
        );
    }

    /**
     * Progress Bar Component
     */
    function ProgressBar(props) {
        var progress = props.progress || {};
        var scored = progress.scored || 0;
        var skipped = progress.skipped || 0;
        var total = progress.total || 0;
        var currentWave = progress.currentWave || 0;
        var totalWaves = progress.totalWaves || 0;
        var percentComplete = progress.percentComplete || 0;

        var containerStyle = {
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#FFFFFF',
            padding: '12px 24px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            minWidth: '300px'
        };

        var labelStyle = {
            fontSize: '13px',
            color: '#4B5563',
            fontWeight: '500',
            whiteSpace: 'nowrap'
        };

        var barContainerStyle = {
            flex: 1,
            height: '8px',
            backgroundColor: '#E5E7EB',
            borderRadius: '4px',
            overflow: 'hidden',
            minWidth: '120px'
        };

        var barFillStyle = {
            width: percentComplete + '%',
            height: '100%',
            backgroundColor: '#3B82F6',
            borderRadius: '4px',
            transition: 'width 0.3s ease-out'
        };

        var countStyle = {
            fontSize: '13px',
            color: '#6B7280',
            whiteSpace: 'nowrap'
        };

        return createElement('div', { style: containerStyle },
            createElement('span', { style: labelStyle }, 'Wave ' + currentWave + '/' + totalWaves),
            createElement('div', { style: barContainerStyle },
                createElement('div', { style: barFillStyle })
            ),
            createElement('span', { style: countStyle }, (scored + skipped) + '/' + total)
        );
    }

    /**
     * Control Buttons (Pause/Update File/Cancel)
     */
    function ControlButtons(props) {
        var onPause = props.onPause;
        var onUpdateFile = props.onUpdateFile;
        var onCancel = props.onCancel;

        var containerStyle = {
            position: 'absolute',
            top: '16px',
            right: '16px',
            display: 'flex',
            gap: '8px',
            zIndex: 200
        };

        var buttonStyle = function(variant) {
            return {
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '500',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: variant === 'cancel' ? '#FEE2E2'
                               : variant === 'update' ? '#DCFCE7'
                               : '#F3F4F6',
                color: variant === 'cancel' ? '#DC2626'
                     : variant === 'update' ? '#166534'
                     : '#4B5563',
                transition: 'background-color 0.15s'
            };
        };

        return createElement('div', { style: containerStyle },
            createElement('button', {
                style: buttonStyle('pause'),
                onClick: onPause
            }, 'Pause'),
            createElement('button', {
                style: buttonStyle('update'),
                onClick: onUpdateFile
            }, 'Update File'),
            createElement('button', {
                style: buttonStyle('cancel'),
                onClick: onCancel
            }, 'Cancel')
        );
    }

    /**
     * Results Summary Modal
     */
    function ResultsSummary(props) {
        var results = props.results || {};
        var onClose = props.onClose;
        var onExport = props.onExport;
        var onReviewUndecided = props.onReviewUndecided;
        var onUpdateFile = props.onUpdateFile;
        var onCancel = props.onCancel;

        var distribution = results.distribution || { 0: 0, 1: 0, 2: 0, 3: 0 };
        var undecidedCount = results.undecidedCount || 0;
        var totalScored = results.totalScored || 0;
        var duration = results.duration || 0;

        var overlayStyle = {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        };

        var modalStyle = {
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        };

        var titleStyle = {
            fontSize: '24px',
            fontWeight: '700',
            color: '#1F2937',
            marginBottom: '24px',
            textAlign: 'center'
        };

        var statRowStyle = {
            display: 'flex',
            alignItems: 'center',
            marginBottom: '12px'
        };

        var barLabelStyle = function(score) {
            return {
                width: '60px',
                fontSize: '14px',
                fontWeight: '500',
                color: score === 0 ? '#6B7280' : SCORE_CONFIG[score].bg
            };
        };

        var barBgStyle = {
            flex: 1,
            height: '24px',
            backgroundColor: '#F3F4F6',
            borderRadius: '4px',
            overflow: 'hidden',
            marginLeft: '12px',
            marginRight: '12px'
        };

        var barFillStyle = function(score, count) {
            var percent = totalScored > 0 ? (count / totalScored) * 100 : 0;
            return {
                width: percent + '%',
                height: '100%',
                backgroundColor: SCORE_CONFIG[score].bg,
                transition: 'width 0.5s ease-out'
            };
        };

        var countLabelStyle = {
            width: '40px',
            fontSize: '14px',
            color: '#6B7280',
            textAlign: 'right'
        };

        var durationMinutes = Math.round(duration / 60000);

        var buttonRowStyle = {
            display: 'flex',
            gap: '12px',
            marginTop: '24px'
        };

        var buttonStyle = function(primary) {
            return {
                flex: 1,
                padding: '12px',
                fontSize: '14px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                backgroundColor: primary ? '#3B82F6' : '#F3F4F6',
                color: primary ? '#FFFFFF' : '#4B5563'
            };
        };

        var undecidedButtonStyle = {
            marginBottom: '12px',
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: '#FEF3C7',
            color: '#92400E'
        };

        var updateButtonStyle = {
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: '#DCFCE7',
            color: '#166534'
        };

        var cancelButtonStyle = {
            flex: 1,
            padding: '12px',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: '#FEE2E2',
            color: '#DC2626'
        };

        return createElement('div', {
            style: overlayStyle,
            onClick: onClose
        },
            createElement('div', {
                style: modalStyle,
                onClick: function(e) { e.stopPropagation(); }
            },
                createElement('div', { style: titleStyle }, '\u2713 Evaluation Complete'),

                createElement('div', { style: { marginBottom: '24px' } },
                    // Distribution bars (3, 2, 1, 0 order - best first)
                    [3, 2, 1, 0].map(function(score) {
                        return createElement('div', { key: score, style: statRowStyle },
                            createElement('span', { style: barLabelStyle(score) }, SCORE_CONFIG[score].label),
                            createElement('div', { style: barBgStyle },
                                createElement('div', { style: barFillStyle(score, distribution[score]) })
                            ),
                            createElement('span', { style: countLabelStyle }, distribution[score])
                        );
                    })
                ),

                createElement('div', {
                    style: { textAlign: 'center', color: '#6B7280', fontSize: '13px', marginBottom: '16px' }
                }, totalScored + ' candidates scored in ' + durationMinutes + ' minutes'),

                undecidedCount > 0 && createElement('button', {
                    style: undecidedButtonStyle,
                    onClick: onReviewUndecided
                }, 'Review ' + undecidedCount + ' Undecided'),

                // Primary action: Update File
                createElement('div', { style: { marginBottom: '12px' } },
                    createElement('button', {
                        style: updateButtonStyle,
                        onClick: onUpdateFile
                    }, 'Update File')
                ),

                // Secondary actions: Cancel and Export
                createElement('div', { style: buttonRowStyle },
                    createElement('button', {
                        style: cancelButtonStyle,
                        onClick: onCancel
                    }, 'Cancel'),
                    createElement('button', {
                        style: buttonStyle(true),
                        onClick: onExport
                    }, 'Export Results')
                )
            )
        );
    }

    /**
     * Main Evaluation Overlay
     * Container for all evaluation mode UI elements
     */
    function EvaluationOverlay(props) {
        var candidates = props.candidates || [];
        var positions = props.positions || new Map();
        var progress = props.progress;
        var exitingIds = props.exitingIds || new Set();
        var onScore = props.onScore;
        var onSkip = props.onSkip;
        var onPause = props.onPause;
        var onUpdateFile = props.onUpdateFile;
        var onCancel = props.onCancel;

        var overlayStyle = {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
            zIndex: 10
        };

        var cardsContainerStyle = {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none'
        };

        return createElement('div', { style: overlayStyle },
            // Progress bar
            createElement('div', { style: { pointerEvents: 'auto' } },
                createElement(ProgressBar, { progress: progress })
            ),

            // Control buttons
            createElement('div', { style: { pointerEvents: 'auto' } },
                createElement(ControlButtons, {
                    onPause: onPause,
                    onUpdateFile: onUpdateFile,
                    onCancel: onCancel
                })
            ),

            // Candidate cards
            createElement('div', { style: cardsContainerStyle },
                candidates.map(function(candidate) {
                    var pos = positions.get(candidate.ID_xA);
                    if (!pos) return null;

                    var isExiting = exitingIds.has(candidate.ID_xA);

                    return createElement('div', {
                        key: candidate.ID_xA,
                        style: { pointerEvents: 'auto' }
                    },
                        createElement(CandidateCard, {
                            candidate: candidate,
                            position: pos,
                            onScore: onScore,
                            onSkip: onSkip,
                            isExiting: isExiting
                        })
                    );
                })
            )
        );
    }

    /**
     * Format config summary for resume display
     */
    function formatConfigSummary(config) {
        if (!config) return '';
        var parts = [];
        if (config.selectionMethod === 'random') {
            parts.push('Random order');
        } else if (config.selectionMethod === 'bottom-ai') {
            parts.push('Lowest AI first');
        }
        if (config.rankFilter === 'ranked') {
            parts.push('Re-evaluating ranked');
        } else if (config.rankFilter === 'all') {
            parts.push('All candidates');
        }
        if (config.groupFilter && config.groupFilter.length > 0) {
            parts.push(config.groupFilter.length + ' groups');
        }
        return parts.length > 0 ? parts.join(' | ') : '';
    }

    /**
     * Evaluation Launcher Modal
     * Shown when user clicks "Start Evaluation"
     * Enhanced with filtering options
     */
    function EvaluationLauncher(props) {
        var totalCandidates = props.totalCandidates || 0;
        var allCandidates = props.allCandidates || [];
        var uniqueGroups = props.uniqueGroups || [];
        var onStart = props.onStart;
        var onCancel = props.onCancel;
        var hasResumable = props.hasResumable;
        var onResume = props.onResume;
        var savedInfo = props.savedInfo;

        // Get evaluation engine reference
        var evaluation = window.GraphApp.core.evaluation;

        // State for filter options (no count - evaluate all matching)
        var _useState4 = useState('top-ai');
        var selectionMethod = _useState4[0];
        var setSelectionMethod = _useState4[1];

        var _useState5 = useState('unranked');
        var rankFilter = _useState5[0];
        var setRankFilter = _useState5[1];

        var _useState6 = useState(0);
        var aiScoreMin = _useState6[0];
        var setAiScoreMin = _useState6[1];

        var _useState7 = useState(100);
        var aiScoreMax = _useState7[0];
        var setAiScoreMax = _useState7[1];

        var _useState8 = useState([]);
        var selectedGroups = _useState8[0];
        var setSelectedGroups = _useState8[1];

        var _useState9 = useState(totalCandidates);
        var eligibleCount = _useState9[0];
        var setEligibleCount = _useState9[1];

        // Compute eligible count when filters change
        useEffect(function() {
            if (allCandidates.length > 0 && evaluation) {
                var count = evaluation.countEligible(allCandidates, {
                    rankFilter: rankFilter,
                    aiScoreThreshold: { min: aiScoreMin, max: aiScoreMax },
                    groupFilter: selectedGroups.length > 0 ? selectedGroups : null
                });
                setEligibleCount(count);
            }
        }, [allCandidates, rankFilter, aiScoreMin, aiScoreMax, selectedGroups]);

        // Handle AI score range changes
        var handleAiMinChange = function(e) {
            var val = parseInt(e.target.value) || 0;
            if (val < 0) val = 0;
            if (val > 100) val = 100;
            setAiScoreMin(val);
        };

        var handleAiMaxChange = function(e) {
            var val = parseInt(e.target.value) || 100;
            if (val < 0) val = 0;
            if (val > 100) val = 100;
            setAiScoreMax(val);
        };

        // Handle group toggle
        var handleGroupToggle = function(groupName) {
            setSelectedGroups(function(prev) {
                var isSelected = prev.includes(groupName);
                if (isSelected) {
                    return prev.filter(function(g) { return g !== groupName; });
                } else {
                    return prev.concat([groupName]);
                }
            });
        };

        // Handle select all groups (clear selection = all included)
        var handleSelectAll = function() {
            setSelectedGroups([]);
        };

        // Handle deselect all groups
        var handleDeselectAll = function() {
            // Select first group only (can't have zero selection)
            setSelectedGroups([uniqueGroups[0]]);
        };

        // Handle start - build options object (no count - evaluate all matching)
        var handleStart = function() {
            onStart({
                selectionMethod: selectionMethod,
                rankFilter: rankFilter,
                aiScoreThreshold: { min: aiScoreMin, max: aiScoreMax },
                groupFilter: selectedGroups.length > 0 ? selectedGroups : null
            });
        };

        // Styles
        var overlayStyle = {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        };

        var modalStyle = {
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '480px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        };

        var titleStyle = {
            fontSize: '20px',
            fontWeight: '700',
            color: '#1F2937',
            marginBottom: '8px'
        };

        var subtitleStyle = {
            fontSize: '14px',
            color: '#6B7280',
            marginBottom: '24px'
        };

        var sectionStyle = {
            marginBottom: '20px'
        };

        var labelStyle = {
            fontSize: '14px',
            color: '#4B5563',
            display: 'block',
            marginBottom: '8px',
            fontWeight: '500'
        };

        var inputStyle = {
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            borderRadius: '8px',
            border: '1px solid #D1D5DB',
            boxSizing: 'border-box'
        };

        var selectStyle = {
            width: '100%',
            padding: '10px 12px',
            fontSize: '14px',
            borderRadius: '8px',
            border: '1px solid #D1D5DB',
            backgroundColor: '#FFFFFF',
            boxSizing: 'border-box'
        };

        var radioGroupStyle = {
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap'
        };

        var radioLabelStyle = {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            color: '#374151',
            cursor: 'pointer'
        };

        var rangeContainerStyle = {
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        };

        var rangeInputStyle = {
            width: '70px',
            padding: '8px 10px',
            fontSize: '14px',
            borderRadius: '6px',
            border: '1px solid #D1D5DB',
            textAlign: 'center'
        };

        var groupContainerStyle = {
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            maxHeight: '120px',
            overflowY: 'auto',
            padding: '4px 0'
        };

        var groupCheckboxStyle = {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            color: '#374151',
            cursor: 'pointer'
        };

        var eligibleStyle = {
            fontSize: '13px',
            color: eligibleCount > 0 ? '#059669' : '#DC2626',
            fontWeight: '500',
            marginBottom: '20px',
            padding: '10px 12px',
            backgroundColor: eligibleCount > 0 ? '#ECFDF5' : '#FEF2F2',
            borderRadius: '8px',
            textAlign: 'center'
        };

        var buttonRowStyle = {
            display: 'flex',
            gap: '12px'
        };

        var buttonStyle = function(primary, disabled) {
            return {
                flex: 1,
                padding: '12px',
                fontSize: '14px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '8px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                backgroundColor: primary ? (disabled ? '#93C5FD' : '#3B82F6') : '#F3F4F6',
                color: primary ? '#FFFFFF' : '#4B5563',
                opacity: disabled ? 0.7 : 1
            };
        };

        var resumeButtonStyle = {
            marginBottom: '16px',
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            fontWeight: '600',
            border: '2px solid #3B82F6',
            borderRadius: '8px',
            cursor: 'pointer',
            backgroundColor: '#EFF6FF',
            color: '#1D4ED8'
        };

        var resumeInfoStyle = {
            fontSize: '12px',
            color: '#6B7280',
            marginBottom: '16px',
            textAlign: 'center'
        };

        var configSummary = savedInfo && savedInfo.config ? formatConfigSummary(savedInfo.config) : '';

        return createElement('div', {
            style: overlayStyle,
            onMouseDown: function(e) {
                // Only close if clicking directly on overlay (not bubbled from children)
                if (e.target === e.currentTarget) {
                    onCancel();
                }
            }
        },
            createElement('div', {
                style: modalStyle,
                onMouseDown: function(e) { e.stopPropagation(); }
            },
                createElement('div', { style: titleStyle }, 'Start Evaluation'),
                createElement('div', { style: subtitleStyle },
                    totalCandidates + ' total candidates'
                ),

                // Resume button - REMOVED in v2.3 (no session persistence)

                // Presentation order (renamed from Selection Method)
                createElement('div', { style: sectionStyle },
                    createElement('label', { style: labelStyle }, 'Selection Method'),
                    createElement('select', {
                        style: selectStyle,
                        value: selectionMethod,
                        onChange: function(e) { setSelectionMethod(e.target.value); },
                        onClick: function(e) { e.stopPropagation(); }
                    },
                        createElement('option', { value: 'top-ai' }, 'Highest AI Score First'),
                        createElement('option', { value: 'random' }, 'Random Selection'),
                        createElement('option', { value: 'bottom-ai' }, 'Lowest AI Score First')
                    )
                ),

                // Rank filter
                createElement('div', { style: sectionStyle },
                    createElement('label', { style: labelStyle }, 'Include Candidates'),
                    createElement('div', { style: radioGroupStyle },
                        ['unranked', 'ranked', 'all'].map(function(value) {
                            var labels = { unranked: 'Unranked Only', ranked: 'Already Ranked', all: 'All' };
                            return createElement('label', { key: value, style: radioLabelStyle },
                                createElement('input', {
                                    type: 'radio',
                                    name: 'rankFilter',
                                    value: value,
                                    checked: rankFilter === value,
                                    onChange: function() { setRankFilter(value); }
                                }),
                                labels[value]
                            );
                        })
                    )
                ),

                // AI Score Range
                createElement('div', { style: sectionStyle },
                    createElement('label', { style: labelStyle }, 'AI Score Range'),
                    createElement('div', { style: rangeContainerStyle },
                        createElement('input', {
                            type: 'number',
                            style: rangeInputStyle,
                            value: aiScoreMin,
                            min: 0,
                            max: 100,
                            onChange: handleAiMinChange,
                            onClick: function(e) { e.stopPropagation(); }
                        }),
                        createElement('span', { style: { color: '#9CA3AF' } }, 'to'),
                        createElement('input', {
                            type: 'number',
                            style: rangeInputStyle,
                            value: aiScoreMax,
                            min: 0,
                            max: 100,
                            onChange: handleAiMaxChange,
                            onClick: function(e) { e.stopPropagation(); }
                        })
                    )
                ),

                // Group filter (only show if there are groups)
                uniqueGroups.length > 1 && createElement('div', { style: sectionStyle },
                    createElement('label', { style: labelStyle }, 'Filter by Groups'),
                    // Select All / Deselect All row
                    createElement('div', { style: { display: 'flex', gap: '16px', marginBottom: '8px' } },
                        createElement('label', { style: groupCheckboxStyle },
                            createElement('input', {
                                type: 'checkbox',
                                checked: selectedGroups.length === 0,
                                onChange: handleSelectAll
                            }),
                            'All'
                        ),
                        createElement('label', { style: groupCheckboxStyle },
                            createElement('input', {
                                type: 'checkbox',
                                checked: selectedGroups.length > 0 && selectedGroups.length < uniqueGroups.length,
                                onChange: handleDeselectAll
                            }),
                            'Deselect All'
                        )
                    ),
                    // Individual groups (horizontal wrap)
                    createElement('div', { style: groupContainerStyle },
                        uniqueGroups.map(function(groupName) {
                            var isSelected = selectedGroups.length === 0 || selectedGroups.includes(groupName);
                            return createElement('label', {
                                key: groupName,
                                style: groupCheckboxStyle
                            },
                                createElement('input', {
                                    type: 'checkbox',
                                    checked: isSelected,
                                    onChange: function() { handleGroupToggle(groupName); }
                                }),
                                groupName
                            );
                        })
                    )
                ),

                // Eligible count preview
                createElement('div', { style: eligibleStyle },
                    eligibleCount > 0
                        ? eligibleCount + ' candidates match filters'
                        : 'No candidates match current filters'
                ),

                // Action buttons
                createElement('div', { style: buttonRowStyle },
                    createElement('button', {
                        style: buttonStyle(false, false),
                        onClick: onCancel
                    }, 'Cancel'),
                    createElement('button', {
                        style: buttonStyle(true, eligibleCount === 0),
                        onClick: handleStart,
                        disabled: eligibleCount === 0
                    }, 'Start')
                )
            )
        );
    }

    // Export to namespace
    window.GraphApp.components.EvaluationOverlay = EvaluationOverlay;
    window.GraphApp.components.EvaluationLauncher = EvaluationLauncher;
    window.GraphApp.components.ResultsSummary = ResultsSummary;
    window.GraphApp.components.CandidateCard = CandidateCard;
    window.GraphApp.components.ProgressBar = ProgressBar;
    window.GraphApp.components.ControlButtons = ControlButtons;

})(window);
