/**
 * Super Speedy Compare Admin JavaScript
 * Main entry point that loads and initializes all modules
 *
 * This file has been refactored to use a modular approach:
 * - super-speedy-compare-common.js: Contains shared functionality (media uploader, tabs, messages, etc.)
 * - super-speedy-compare-plugins.js: Contains plugin-related functionality
 * - super-speedy-compare-competitors.js: Contains competitor-related functionality
 * - super-speedy-compare-features.js: Contains feature-related functionality
 */

(function($) {
    'use strict';

    // Main Admin JS
    const SSC_Admin = {
        // Initialize
        init: function() {
            // Initialize common module
            if (typeof SSC_Common !== 'undefined') {
                SSC_Common.init();
            }
            
            // Initialize plugins module
            if (typeof SSC_Plugins !== 'undefined') {
                SSC_Plugins.init();
            }
            
            // Initialize competitors module
            if (typeof SSC_Competitors !== 'undefined') {
                SSC_Competitors.init();
            }
            
            // Initialize features module
            if (typeof SSC_Features !== 'undefined') {
                SSC_Features.init();
            }
        }
    };

    // Initialize on document ready
    $(document).ready(function() {
        SSC_Admin.init();
    });

})(jQuery);