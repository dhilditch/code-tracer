<?php
/**
 * The main plugin class
 *
 * @usedby ../super-speedy-compare.php:25, 42, 50 (reference)
 */
class Super_Speedy_Compare {

    /**
     * Initialize the plugin
     */
    public function init() {
        // Load plugin dependencies
        $this->load_dependencies();
        
        // Register admin hooks
        $this->define_admin_hooks();
    }

    /**
     * Load the required dependencies for this plugin.
     */
    private function load_dependencies() {
        // Admin class
        require_once SSC_PLUGIN_DIR . 'admin/class-super-speedy-compare-admin.php';
        
        // DB class
        require_once SSC_PLUGIN_DIR . 'includes/class-super-speedy-compare-db.php';
    }

    /**
     * Register all of the hooks related to the admin area functionality
     */
    private function define_admin_hooks() {
        $admin = new Super_Speedy_Compare_Admin();
        
        // Add admin menu
        add_action('admin_menu', array($admin, 'add_admin_menu'));
        
        // Register admin assets
        add_action('admin_enqueue_scripts', array($admin, 'enqueue_styles'));
        add_action('admin_enqueue_scripts', array($admin, 'enqueue_scripts'));
        
        // Register AJAX handlers
        add_action('wp_ajax_ssc_save_my_plugin', array($admin, 'save_my_plugin'));
        add_action('wp_ajax_ssc_save_competitor', array($admin, 'save_competitor'));
        add_action('wp_ajax_ssc_save_feature', array($admin, 'save_feature'));
        add_action('wp_ajax_ssc_save_plugin_feature', array($admin, 'save_plugin_feature'));
        add_action('wp_ajax_ssc_delete_my_plugin', array($admin, 'delete_my_plugin'));
        add_action('wp_ajax_ssc_delete_competitor', array($admin, 'delete_competitor'));
        add_action('wp_ajax_ssc_delete_feature', array($admin, 'delete_feature'));
        add_action('wp_ajax_ssc_get_plugin_data', array($admin, 'get_plugin_data'));
        add_action('wp_ajax_ssc_get_features', array($admin, 'get_features'));
        add_action('wp_ajax_ssc_get_competitors', array($admin, 'get_competitors'));
    }
}