/**
 * Evaluation Engine
 *
 * Core logic for candidate evaluation mode.
 * Handles session management, scoring, batching, and localStorage persistence.
 * No React dependency - pure JavaScript.
 */

(function(window) {
    'use strict';

    // Ensure namespace exists
    window.GraphApp = window.GraphApp || {};
    window.GraphApp.core = window.GraphApp.core || {};

    // ==================== Grid Constants ====================
    // Grid size is now centralized in js/config/constants.js

    var GRID_SIZE = window.GraphApp.config.constants.evaluation.GRID_SIZE;

    // ==================== Filtering Helper Functions ====================

    /**
     * Default session options
     */
    // Grid size from constants (3×3 = 9 cells)
    var evalConfig = window.GraphApp.config.constants.evaluation;
    var GRID_CAPACITY = evalConfig.GRID_SIZE * evalConfig.GRID_SIZE;

    var DEFAULT_SESSION_OPTIONS = {
        selectionCount: 50,
        batchSize: GRID_CAPACITY,  // Match grid capacity (9 for 3×3)
        selectionMethod: 'top-ai',     // 'top-ai' | 'random' | 'bottom-ai'
        rankFilter: 'unranked',        // 'unranked' | 'ranked' | 'all'
        aiScoreThreshold: { min: 0, max: 100 },
        groupFilter: null,             // null = all, or ['GroupA', 'GroupB']
        randomSeed: null               // For reproducible random selection
    };

    /**
     * Apply group filter
     * @param {Array} candidates
     * @param {Array|null} groupFilter - Array of group names or null for all
     * @returns {Array} filtered candidates
     */
    function applyGroupFilter(candidates, groupFilter) {
        if (!groupFilter || !Array.isArray(groupFilter) || groupFilter.length === 0) {
            return candidates;
        }
        var groupSet = new Set(groupFilter);
        return candidates.filter(function(c) {
            return groupSet.has(c.Group_xA);
        });
    }

    /**
     * Apply rank filter
     * @param {Array} candidates
     * @param {string} rankFilter - 'unranked' | 'ranked' | 'all'
     * @returns {Array} filtered candidates
     */
    function applyRankFilter(candidates, rankFilter) {
        switch (rankFilter) {
            case 'unranked':
                return candidates.filter(function(c) {
                    return c.Rank_xB === '' || c.Rank_xB === undefined || c.Rank_xB === null;
                });
            case 'ranked':
                return candidates.filter(function(c) {
                    return c.Rank_xB !== '' && c.Rank_xB !== undefined && c.Rank_xB !== null;
                });
            case 'all':
            default:
                return candidates;
        }
    }

    /**
     * Apply AI score threshold
     * @param {Array} candidates
     * @param {Object} threshold - { min, max }
     * @returns {Array} filtered candidates
     */
    function applyAIScoreThreshold(candidates, threshold) {
        if (!threshold) return candidates;
        var min = threshold.min !== undefined ? threshold.min : 0;
        var max = threshold.max !== undefined ? threshold.max : 100;
        var isFullRange = min === 0 && max === 100;

        return candidates.filter(function(c) {
            var aiRank = c.AI_Rank_xB;
            var isEmpty = aiRank === '' || aiRank === undefined || aiRank === null;

            if (isEmpty) {
                return isFullRange; // Include empty only if full range
            }

            var value = parseInt(aiRank);
            return !isNaN(value) && value >= min && value <= max;
        });
    }

    /**
     * Mulberry32 PRNG - fast, decent quality seeded random
     * @param {number} seed
     * @returns {Function} random number generator (0-1)
     */
    function mulberry32(seed) {
        return function() {
            var t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    /**
     * Seeded shuffle using Fisher-Yates algorithm
     * @param {Array} array - Array to shuffle (will be modified)
     * @param {number|null} seed - Random seed or null to generate
     * @returns {Array} shuffled array
     */
    function seededShuffle(array, seed) {
        if (seed === null || seed === undefined) {
            seed = Date.now();
        }
        var random = mulberry32(seed);
        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    }

    /**
     * Apply selection method (sort or shuffle)
     * @param {Array} candidates
     * @param {string} method - 'top-ai' | 'random' | 'bottom-ai'
     * @param {number|null} seed - Random seed for reproducibility
     * @returns {Array} ordered candidates
     */
    function applySelectionMethod(candidates, method, seed) {
        var result = candidates.slice(); // Copy array
        switch (method) {
            case 'top-ai':
                return result.sort(function(a, b) {
                    var rankA = parseInt(a.AI_Rank_xB) || 0;
                    var rankB = parseInt(b.AI_Rank_xB) || 0;
                    return rankB - rankA; // Descending
                });
            case 'bottom-ai':
                return result.sort(function(a, b) {
                    var rankA = parseInt(a.AI_Rank_xB) || 0;
                    var rankB = parseInt(b.AI_Rank_xB) || 0;
                    return rankA - rankB; // Ascending
                });
            case 'random':
                return seededShuffle(result, seed);
            default:
                return result;
        }
    }

    /**
     * Main filtering pipeline - applies all filters in order
     * @param {Array} allCandidates
     * @param {Object} options
     * @returns {Array} filtered and ordered candidates
     */
    function filterCandidates(allCandidates, options) {
        var candidates = allCandidates;

        // Step 1: Valid name filter (existing requirement)
        candidates = candidates.filter(function(c) {
            return c.Node_xA && c.Node_xA.trim() !== '';
        });

        // Step 2: Group filter
        candidates = applyGroupFilter(candidates, options.groupFilter);

        // Step 3: Rank filter
        candidates = applyRankFilter(candidates, options.rankFilter);

        // Step 4: AI score threshold
        candidates = applyAIScoreThreshold(candidates, options.aiScoreThreshold);

        // Step 5: Selection method (sort or shuffle)
        candidates = applySelectionMethod(candidates, options.selectionMethod, options.randomSeed);

        // Step 6: Selection count
        return candidates.slice(0, Math.min(options.selectionCount, candidates.length));
    }

    /**
     * Count eligible candidates (for UI preview)
     * Applies filters but NOT selection method or count
     * @param {Array} allCandidates
     * @param {Object} options
     * @returns {number} count of eligible candidates
     */
    function countEligibleCandidates(allCandidates, options) {
        var candidates = allCandidates;

        // Valid name filter
        candidates = candidates.filter(function(c) {
            return c.Node_xA && c.Node_xA.trim() !== '';
        });

        // Group filter
        candidates = applyGroupFilter(candidates, options.groupFilter);

        // Rank filter
        candidates = applyRankFilter(candidates, options.rankFilter);

        // AI score threshold
        candidates = applyAIScoreThreshold(candidates, options.aiScoreThreshold);

        return candidates.length;
    }

    // ==================== Grid Helper Functions ====================

    /**
     * Initialize grid state for a session
     * @returns {Object} grid state object
     */
    function initGrid() {
        // Create all available cells as array of {row, col}
        var availableCells = [];
        for (var row = 0; row < GRID_SIZE; row++) {
            for (var col = 0; col < GRID_SIZE; col++) {
                availableCells.push({ row: row, col: col });
            }
        }

        return {
            cells: new Map(),           // Map of "row,col" -> candidateId
            availableCells: availableCells,
            cellSize: { width: 140, height: 100 },
            spacing: 10
        };
    }

    /**
     * Assign a grid cell to a candidate (random selection)
     * @param {Object} candidate - The candidate to assign
     * @param {Object} grid - The grid state object
     * @returns {Object|null} {row, col} or null if no cells available
     */
    function assignGridCell(candidate, grid) {
        if (grid.availableCells.length === 0) return null;

        // Random selection from available cells
        var idx = Math.floor(Math.random() * grid.availableCells.length);
        var cell = grid.availableCells.splice(idx, 1)[0];

        // Track assignment
        grid.cells.set(cell.row + ',' + cell.col, candidate.ID_xA);

        return cell;
    }

    /**
     * Release a grid cell back to available pool
     * @param {number} row
     * @param {number} col
     * @param {Object} grid
     */
    function releaseGridCell(row, col, grid) {
        var key = row + ',' + col;
        if (grid.cells.has(key)) {
            grid.cells.delete(key);
            grid.availableCells.push({ row: row, col: col });
        }
    }

    // ==================== Evaluation Engine ====================

    const EvaluationEngine = {

        /**
         * Create a new evaluation session
         * @param {Array} allCandidates - All nodes from the app
         * @param {Object} options - Session configuration options
         * @returns {Object} session object or error object
         */
        createSession: function(allCandidates, options) {
            // Merge with defaults
            options = Object.assign({}, DEFAULT_SESSION_OPTIONS, options || {});

            // Generate random seed if using random selection and none provided
            if (options.selectionMethod === 'random' && !options.randomSeed) {
                options.randomSeed = Date.now();
            }

            // Apply filtering pipeline
            var selected = filterCandidates(allCandidates, options);

            // Handle empty result set
            if (selected.length === 0) {
                return {
                    error: 'No candidates match the current filters',
                    suggestions: [
                        'Try expanding the AI score range',
                        'Include ranked candidates (change rank filter to "all")',
                        'Select more groups'
                    ]
                };
            }

            // Clear any previous session
            this.clearSession();

            var session = {
                id: 'eval-' + Date.now(),
                selectedCandidates: selected,
                selectedIds: selected.map(function(c) { return c.ID_xA; }),
                batchSize: options.batchSize,
                currentBatchIndex: 0,
                currentBatchCandidates: [],  // Candidates currently displayed in grid
                scores: new Map(),
                undecided: new Set(),
                startedAt: Date.now(),
                completedAt: null,
                // Grid state for canvas-based evaluation
                grid: initGrid(),
                // Store config for session resumption
                config: {
                    selectionCount: options.selectionCount,
                    selectionMethod: options.selectionMethod,
                    rankFilter: options.rankFilter,
                    aiScoreThreshold: options.aiScoreThreshold,
                    groupFilter: options.groupFilter,
                    randomSeed: options.randomSeed
                }
            };

            // Save initial session
            this.saveSession(session);

            return session;
        },

        /**
         * Get the current batch of candidates to display
         * @param {Object} session
         * @returns {Array} current batch (up to batchSize candidates)
         */
        getCurrentBatch: function(session) {
            var self = this;
            var selectedCandidates = session.selectedCandidates;
            var batchSize = session.batchSize;
            var currentBatchIndex = session.currentBatchIndex;
            var scores = session.scores;
            var undecided = session.undecided;

            // Calculate which candidates should be in this batch
            var start = currentBatchIndex * batchSize;
            var end = start + batchSize;
            var batchCandidates = selectedCandidates.slice(start, end);

            // Filter out any that have already been scored or skipped
            return batchCandidates.filter(function(c) {
                return !scores.has(c.ID_xA) && !undecided.has(c.ID_xA);
            });
        },

        /**
         * Advance to the next batch
         * @param {Object} session
         * @returns {boolean} true if there are more batches, false if done
         */
        advanceToNextBatch: function(session) {
            var totalBatches = Math.ceil(session.selectedCandidates.length / session.batchSize);

            if (session.currentBatchIndex < totalBatches - 1) {
                session.currentBatchIndex++;
                this.saveSession(session);
                return true;
            }

            return false;
        },

        /**
         * Score a candidate
         * @param {Object} session
         * @param {string} candidateId
         * @param {number} score - 0, 1, 2, or 3
         * @returns {Object} { success, evaluationComplete }
         */
        scoreCandidate: function(session, candidateId, score) {
            if (session.scores.has(candidateId)) {
                return { success: false, error: 'Already scored' };
            }

            session.scores.set(candidateId, {
                score: score,
                timestamp: Date.now(),
                waveNumber: session.currentBatchIndex + 1
            });

            // Save to localStorage
            this.saveSession(session);

            // Check completion
            var totalToEvaluate = session.selectedCandidates.length;
            var totalProcessed = session.scores.size + session.undecided.size;
            var evaluationComplete = totalProcessed >= totalToEvaluate;

            if (evaluationComplete) {
                session.completedAt = Date.now();
                this.saveSession(session);
            }

            return {
                success: true,
                evaluationComplete: evaluationComplete
            };
        },

        /**
         * Skip a candidate (mark as undecided)
         * @param {Object} session
         * @param {string} candidateId
         * @returns {Object} { success, evaluationComplete }
         */
        skipCandidate: function(session, candidateId) {
            session.undecided.add(candidateId);
            this.saveSession(session);

            var totalToEvaluate = session.selectedCandidates.length;
            var totalProcessed = session.scores.size + session.undecided.size;
            var evaluationComplete = totalProcessed >= totalToEvaluate;

            if (evaluationComplete) {
                session.completedAt = Date.now();
                this.saveSession(session);
            }

            return {
                success: true,
                evaluationComplete: evaluationComplete
            };
        },

        /**
         * Get progress statistics
         * @param {Object} session
         * @returns {Object} progress stats
         */
        getProgress: function(session) {
            if (!session) {
                return { total: 0, scored: 0, skipped: 0, remaining: 0, currentWave: 0, totalWaves: 0, percentComplete: 0 };
            }

            var total = session.selectedCandidates.length;
            var scored = session.scores.size;
            var skipped = session.undecided.size;
            var currentWave = session.currentBatchIndex + 1;
            var totalWaves = Math.ceil(total / session.batchSize);
            var percentComplete = total > 0 ? Math.round(((scored + skipped) / total) * 100) : 0;

            return {
                total: total,
                scored: scored,
                skipped: skipped,
                remaining: total - scored - skipped,
                currentWave: currentWave,
                totalWaves: totalWaves,
                percentComplete: percentComplete
            };
        },

        /**
         * Get final results
         * @param {Object} session
         * @returns {Object} results summary
         */
        getResults: function(session) {
            if (!session) {
                return { distribution: { 0: 0, 1: 0, 2: 0, 3: 0 }, undecidedCount: 0, totalScored: 0, duration: 0, scoredCandidates: [], undecidedCandidates: [] };
            }

            var distribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
            var scoredCandidates = [];

            session.scores.forEach(function(data, id) {
                distribution[data.score]++;
                var candidate = session.selectedCandidates.find(function(c) { return c.ID_xA === id; });
                if (candidate) {
                    // Create a copy with score data
                    var scoredCandidate = Object.assign({}, candidate, {
                        User_Score: data.score,
                        Score_Timestamp: data.timestamp,
                        Wave_Number: data.waveNumber
                    });
                    scoredCandidates.push(scoredCandidate);
                }
            });

            // Sort by score descending (loved first)
            scoredCandidates.sort(function(a, b) {
                return b.User_Score - a.User_Score;
            });

            var undecidedCandidates = session.selectedCandidates.filter(function(c) {
                return session.undecided.has(c.ID_xA);
            });

            return {
                distribution: distribution,
                undecidedCount: session.undecided.size,
                totalScored: session.scores.size,
                duration: (session.completedAt || Date.now()) - session.startedAt,
                scoredCandidates: scoredCandidates,
                undecidedCandidates: undecidedCandidates
            };
        },

        /**
         * Save session to localStorage
         * @param {Object} session
         */
        saveSession: function(session) {
            try {
                // Serialize grid state
                var gridState = null;
                if (session.grid) {
                    gridState = {
                        cells: Array.from(session.grid.cells.entries()),
                        availableCells: session.grid.availableCells,
                        cellSize: session.grid.cellSize,
                        spacing: session.grid.spacing
                    };
                }

                // Serialize current batch candidate IDs and positions
                var currentBatchData = (session.currentBatchCandidates || []).map(function(c) {
                    return { id: c.ID_xA, gridRow: c.gridRow, gridCol: c.gridCol };
                });

                var serializable = {
                    id: session.id,
                    selectedIds: session.selectedIds,
                    batchSize: session.batchSize,
                    currentBatchIndex: session.currentBatchIndex,
                    currentBatchData: currentBatchData,
                    scores: Array.from(session.scores.entries()),
                    undecided: Array.from(session.undecided),
                    startedAt: session.startedAt,
                    completedAt: session.completedAt,
                    lastSaved: Date.now(),
                    grid: gridState,
                    // Persist config for resumption
                    config: session.config || {}
                };
                localStorage.setItem('haystack_eval_session', JSON.stringify(serializable));
            } catch (e) {
                console.warn('Failed to save evaluation session:', e);
            }
        },

        /**
         * Load session from localStorage
         * @param {Array} allCandidates - Current nodes array to reconstruct candidates
         * @returns {Object|null} session or null if none/invalid
         */
        loadSession: function(allCandidates) {
            try {
                var saved = localStorage.getItem('haystack_eval_session');
                if (!saved) return null;

                var data = JSON.parse(saved);

                // Don't load completed sessions
                if (data.completedAt) {
                    return null;
                }

                // Reconstruct selectedCandidates from IDs
                var candidateMap = new Map();
                allCandidates.forEach(function(c) {
                    candidateMap.set(c.ID_xA, c);
                });

                var selectedCandidates = data.selectedIds
                    .map(function(id) { return candidateMap.get(id); })
                    .filter(function(c) { return c !== undefined; });

                // If too many candidates are missing, session is invalid
                if (selectedCandidates.length < data.selectedIds.length * 0.9) {
                    console.warn('Session data mismatch - too many missing candidates');
                    this.clearSession();
                    return null;
                }

                // Restore grid state
                var grid = initGrid();
                if (data.grid) {
                    grid.cells = new Map(data.grid.cells);
                    grid.availableCells = data.grid.availableCells;
                    grid.cellSize = data.grid.cellSize || grid.cellSize;
                    grid.spacing = data.grid.spacing || grid.spacing;
                }

                // Restore current batch candidates with grid positions
                var currentBatchCandidates = [];
                if (data.currentBatchData) {
                    data.currentBatchData.forEach(function(item) {
                        var c = candidateMap.get(item.id);
                        if (c) {
                            c.gridRow = item.gridRow;
                            c.gridCol = item.gridCol;
                            currentBatchCandidates.push(c);
                        }
                    });
                }

                return {
                    id: data.id,
                    selectedCandidates: selectedCandidates,
                    selectedIds: data.selectedIds,
                    batchSize: data.batchSize,
                    currentBatchIndex: data.currentBatchIndex,
                    currentBatchCandidates: currentBatchCandidates,
                    scores: new Map(data.scores),
                    undecided: new Set(data.undecided),
                    startedAt: data.startedAt,
                    completedAt: data.completedAt,
                    grid: grid,
                    // Restore config for display
                    config: data.config || {}
                };
            } catch (e) {
                console.warn('Failed to load evaluation session:', e);
                return null;
            }
        },

        /**
         * Clear saved session
         */
        clearSession: function() {
            try {
                localStorage.removeItem('haystack_eval_session');
            } catch (e) {
                console.warn('Failed to clear evaluation session:', e);
            }
        },

        /**
         * Check if there's a resumable session
         * @returns {boolean}
         */
        hasResumableSession: function() {
            try {
                var saved = localStorage.getItem('haystack_eval_session');
                if (!saved) return false;
                var data = JSON.parse(saved);
                return !data.completedAt; // Not completed = resumable
            } catch (e) {
                return false;
            }
        },

        /**
         * Get saved session info (for UI display)
         * @returns {Object|null} { scored, total, lastSaved, config }
         */
        getSavedSessionInfo: function() {
            try {
                var saved = localStorage.getItem('haystack_eval_session');
                if (!saved) return null;
                var data = JSON.parse(saved);
                if (data.completedAt) return null;
                return {
                    scored: data.scores.length,
                    total: data.selectedIds.length,
                    lastSaved: data.lastSaved,
                    // Include config for UI display
                    config: data.config || {}
                };
            } catch (e) {
                return null;
            }
        },

        /**
         * Count eligible candidates (exposed for UI preview)
         * @param {Array} allCandidates
         * @param {Object} options - Filter options
         * @returns {number} count of eligible candidates
         */
        countEligible: function(allCandidates, options) {
            return countEligibleCandidates(allCandidates, options);
        },

        /**
         * Get default session options
         * @returns {Object} default options
         */
        getDefaultOptions: function() {
            return Object.assign({}, DEFAULT_SESSION_OPTIONS);
        },

        // ==================== Grid Methods ====================

        /**
         * Get next batch of candidates with grid positions assigned
         * @param {Object} session
         * @returns {Array} candidates with gridRow, gridCol properties
         */
        getNextBatchWithGridPositions: function(session) {
            var batchSize = session.batchSize;
            var candidates = session.selectedCandidates;
            var scores = session.scores;
            var undecided = session.undecided;
            var grid = session.grid;

            // Find unprocessed candidates
            var unprocessed = candidates.filter(function(c) {
                return !scores.has(c.ID_xA) && !undecided.has(c.ID_xA);
            });

            // Take up to batchSize and create copies with grid positions
            var batch = unprocessed.slice(0, batchSize).map(function(c) {
                var cell = assignGridCell(c, grid);
                if (cell) {
                    // Return copy with grid position (don't mutate original)
                    return Object.assign({}, c, {
                        gridRow: cell.row,
                        gridCol: cell.col
                    });
                }
                return Object.assign({}, c);
            });

            // Store current batch
            session.currentBatchCandidates = batch;
            this.saveSession(session);

            return batch;
        },

        /**
         * Remove a candidate from the current batch (wave-based, no replacement)
         * @param {Object} session
         * @param {string} candidateId - ID of the candidate leaving
         * @returns {number} remaining candidates in batch
         */
        removeFromBatch: function(session, candidateId) {
            var grid = session.grid;
            var currentBatch = session.currentBatchCandidates;

            // Find the departing candidate's grid position
            var departing = currentBatch.find(function(c) { return c.ID_xA === candidateId; });
            if (departing && departing.gridRow !== undefined) {
                // Release the grid cell
                releaseGridCell(departing.gridRow, departing.gridCol, grid);
            }

            // Remove from current batch
            session.currentBatchCandidates = currentBatch.filter(function(c) {
                return c.ID_xA !== candidateId;
            });

            this.saveSession(session);
            return session.currentBatchCandidates.length;
        },

        /**
         * Release a candidate's grid cell and get a replacement
         * @param {Object} session
         * @param {string} candidateId - ID of the candidate leaving
         * @returns {Object|null} new candidate with grid position, or null if none left
         */
        replaceInGrid: function(session, candidateId) {
            var candidates = session.selectedCandidates;
            var scores = session.scores;
            var undecided = session.undecided;
            var grid = session.grid;
            var currentBatch = session.currentBatchCandidates;

            // Find the departing candidate's grid position
            var departing = currentBatch.find(function(c) { return c.ID_xA === candidateId; });
            if (!departing || departing.gridRow === undefined) return null;

            // Release the grid cell
            releaseGridCell(departing.gridRow, departing.gridCol, grid);

            // Remove from current batch
            session.currentBatchCandidates = currentBatch.filter(function(c) {
                return c.ID_xA !== candidateId;
            });

            // Find next unprocessed candidate not in current batch
            var currentIds = new Set(session.currentBatchCandidates.map(function(c) { return c.ID_xA; }));
            var next = candidates.find(function(c) {
                return !scores.has(c.ID_xA) &&
                       !undecided.has(c.ID_xA) &&
                       !currentIds.has(c.ID_xA);
            });

            if (next) {
                // Create a copy with grid position (don't mutate original)
                var nextWithGrid = Object.assign({}, next, {
                    gridRow: departing.gridRow,
                    gridCol: departing.gridCol
                });
                grid.cells.set(nextWithGrid.gridRow + ',' + nextWithGrid.gridCol, nextWithGrid.ID_xA);
                session.currentBatchCandidates.push(nextWithGrid);
                this.saveSession(session);
                return nextWithGrid;
            }

            this.saveSession(session);
            return null;
        },

        // ==================== Mass Score Methods ====================

        /**
         * Mass-score all candidates matching a root or class
         * Operates on FULL dataset (allNodes), not just session.selectedCandidates
         * @param {Object} session
         * @param {string} attributeType - 'root' or 'class'
         * @param {string} attributeValue - The value to match
         * @param {number} score - Score to assign (0-3)
         * @param {Array} allNodes - Full dataset to search (optional, defaults to selectedCandidates)
         * @returns {Object} { affected, alreadyScored, scoredIds }
         */
        massScoreByAttribute: function(session, attributeType, attributeValue, score, allNodes) {
            var self = this;
            // Use full dataset if provided, otherwise fall back to selected candidates
            var candidates = allNodes || session.selectedCandidates;

            // Find matching candidates (from full dataset)
            var matching = candidates.filter(function(c) {
                if (attributeType === 'root') {
                    return c.Root1_xB === attributeValue ||
                           c.Root2_xB === attributeValue ||
                           c.Root3_xB === attributeValue;
                } else { // class
                    return c.Class1_xB === attributeValue ||
                           c.Class2_xB === attributeValue ||
                           c.Class3_xB === attributeValue;
                }
            });

            var affected = 0;
            var reScored = 0;  // Count of already-ranked that get re-scored
            var scoredIds = [];

            matching.forEach(function(c) {
                // Track if this was already scored BEFORE we set the new score
                var wasAlreadyScored = session.scores.has(c.ID_xA);
                if (wasAlreadyScored) {
                    reScored++;
                }

                // Directly set the score (bypasses scoreCandidate's "already scored" check)
                session.scores.set(c.ID_xA, {
                    score: score,
                    timestamp: Date.now(),
                    waveNumber: session.currentBatchIndex + 1,
                    massScored: true  // Flag to indicate this was mass-scored
                });

                scoredIds.push(c.ID_xA);
                affected++;
            });

            // Release grid cells for scored candidates in current batch
            scoredIds.forEach(function(id) {
                // Find and release the grid cell if this candidate was in the grid
                session.grid.cells.forEach(function(candidateId, cellKey) {
                    if (candidateId === id) {
                        var parts = cellKey.split(',');
                        releaseGridCell(parseInt(parts[0]), parseInt(parts[1]), session.grid);
                    }
                });
            });

            // Remove scored candidates from currentBatchCandidates
            session.currentBatchCandidates = session.currentBatchCandidates.filter(function(c) {
                return scoredIds.indexOf(c.ID_xA) === -1;
            });

            // Check if evaluation is complete
            var totalToEvaluate = session.selectedCandidates.length;
            var totalProcessed = session.scores.size + session.undecided.size;
            if (totalProcessed >= totalToEvaluate) {
                session.completedAt = Date.now();
            }

            this.saveSession(session);

            return { affected: affected, reScored: reScored, scoredIds: scoredIds };
        },

        /**
         * Count candidates matching a root or class in full dataset
         * @param {string} attributeType - 'root' or 'class'
         * @param {string} attributeValue - The value to match
         * @param {Array} allNodes - Full dataset to search
         * @returns {number} count of matching candidates
         */
        countByAttribute: function(attributeType, attributeValue, allNodes) {
            var candidates = allNodes || [];

            return candidates.filter(function(c) {
                if (attributeType === 'root') {
                    return c.Root1_xB === attributeValue ||
                           c.Root2_xB === attributeValue ||
                           c.Root3_xB === attributeValue;
                } else {
                    return c.Class1_xB === attributeValue ||
                           c.Class2_xB === attributeValue ||
                           c.Class3_xB === attributeValue;
                }
            }).length;
        },

        /**
         * Get unique roots from current batch candidates
         * @param {Object} session
         * @returns {Array} [{root, class, count}, ...]
         */
        getCurrentBatchRoots: function(session) {
            var batch = session.currentBatchCandidates || [];
            var rootMap = new Map();

            batch.forEach(function(c) {
                [
                    { root: c.Root1_xB, cls: c.Class1_xB },
                    { root: c.Root2_xB, cls: c.Class2_xB },
                    { root: c.Root3_xB, cls: c.Class3_xB }
                ].forEach(function(r) {
                    if (r.root) {
                        var key = r.root + '|' + (r.cls || '');
                        if (!rootMap.has(key)) {
                            rootMap.set(key, { root: r.root, cls: r.cls, count: 0 });
                        }
                        rootMap.get(key).count++;
                    }
                });
            });

            return Array.from(rootMap.values());
        },

        // ==================== SIMPLIFIED API (v2.3) ====================
        // These methods support immediate-sync evaluation without session persistence

        /**
         * Create a lightweight grid for batch positioning (no session)
         * @returns {Object} grid state object
         */
        createGrid: function() {
            return initGrid();
        },

        /**
         * Get next batch of candidates with grid positions (no session)
         * Filters nodes and returns batch with grid cell assignments
         * @param {Array} nodes - All nodes from app state
         * @param {Object} filters - { rankFilter, groupFilter, aiScoreRange, selectionMethod }
         * @param {Array} currentBatchIds - IDs currently displayed (to exclude)
         * @param {Object} grid - Grid state from createGrid()
         * @param {number} batchSize - How many to return (default 6)
         * @returns {Array} candidates with gridRow, gridCol properties
         */
        getFilteredBatch: function(nodes, filters, currentBatchIds, grid, batchSize) {
            batchSize = batchSize || 6;
            var currentSet = new Set(currentBatchIds || []);

            // Build options object for existing filter functions
            var options = {
                selectionCount: 9999,  // No limit - we filter by batch
                rankFilter: filters.rankFilter || 'unranked',
                aiScoreThreshold: {
                    min: filters.aiScoreRange ? filters.aiScoreRange[0] : 0,
                    max: filters.aiScoreRange ? filters.aiScoreRange[1] : 100
                },
                groupFilter: filters.groupFilter && filters.groupFilter.length > 0 ? filters.groupFilter : null,
                selectionMethod: filters.selectionMethod || 'top-ai',
                randomSeed: Date.now()
            };

            // Use existing filter pipeline
            var eligible = filterCandidates(nodes, options);

            // Exclude currently displayed
            eligible = eligible.filter(function(c) {
                return !currentSet.has(c.ID_xA);
            });

            // Take batch and assign grid positions
            var batch = eligible.slice(0, batchSize).map(function(c) {
                var cell = assignGridCell(c, grid);
                if (cell) {
                    return Object.assign({}, c, {
                        gridRow: cell.row,
                        gridCol: cell.col
                    });
                }
                return Object.assign({}, c);
            });

            return batch;
        },

        /**
         * Release a grid cell when candidate is removed
         * @param {number} row
         * @param {number} col
         * @param {Object} grid
         */
        releaseCell: function(row, col, grid) {
            releaseGridCell(row, col, grid);
        },

        /**
         * Count eligible candidates for given filters (for UI display)
         * @param {Array} nodes
         * @param {Object} filters
         * @returns {number}
         */
        countEligible: function(nodes, filters) {
            var options = {
                rankFilter: filters.rankFilter || 'unranked',
                aiScoreThreshold: {
                    min: filters.aiScoreRange ? filters.aiScoreRange[0] : 0,
                    max: filters.aiScoreRange ? filters.aiScoreRange[1] : 100
                },
                groupFilter: filters.groupFilter && filters.groupFilter.length > 0 ? filters.groupFilter : null
            };
            return countEligibleCandidates(nodes, options);
        }
    };

    // Export to namespace
    window.GraphApp.core.evaluation = EvaluationEngine;

})(window);
