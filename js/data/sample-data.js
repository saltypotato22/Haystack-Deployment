/**
 * Sample Data Module
 * Initializes the data namespace and provides helper function for demo files
 *
 * Demo files are loaded separately from js/data/demos/*.js
 * To add a new demo:
 * 1. Create js/data/demos/my-demo.js using the node() helper
 * 2. Add <script src="js/data/demos/my-demo.js"></script> to index.html
 */

(function(window) {
    'use strict';

    // Initialize data namespace with demos container and helper function
    window.GraphApp.data = {
        // Container for demos (populated by individual demo files)
        demos: {},

        // Helper function to create node objects (used by demo files)
        // Link parameters removed - feature deprecated
        node: (group, nodeName) => ({
            Group_xA: group,
            Node_xA: nodeName,
            ID_xA: `${group}-${nodeName}`,
            Linked_Node_ID_xA: '',
            Hidden_Node_xB: 0,
            Hidden_Link_xB: 0,
            Link_Label_xB: '',
            Link_Arrow_xB: 'To',
            AI_Rank_xB: '',
            Rank_xB: '',
            Root1_xB: '',
            Class1_xB: '',
            Root2_xB: '',
            Class2_xB: '',
            Root3_xB: '',
            Class3_xB: '',
            // Optional metadata fields (for info popup)
            Group_Info: '',
            Node_Info: ''
        })
    };

})(window);
