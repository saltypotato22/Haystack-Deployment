/**
 * Application Constants
 * Centralized configuration values used across multiple modules
 *
 * NOTE: This file must be loaded BEFORE modules that use these constants
 * (evaluation-engine.js, cytoscape-renderer.js)
 */

(function(window) {
    'use strict';

    window.GraphApp.config.constants = {
        // Evaluation grid configuration
        // Change these values to adjust the evaluation grid globally
        evaluation: {
            GRID_SIZE: 3,        // Grid dimensions (3 = 3×3 grid)
            CELL_WIDTH: 200,     // Cell width in model units
            CELL_HEIGHT: 200,    // Cell height in model units (taller for vertical layout)
            CELL_SPACING: 12     // Spacing between cells
        }
    };

})(window);
