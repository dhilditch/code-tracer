<?php
/**
 * The admin-specific functionality of the plugin
 */
class Super_Speedy_Compare_Admin {

    /**
     * Initialize the class
     */
    public function __construct() {
        // Constructor
    }

    /**
     * Register the stylesheets for the admin area
     */
    public function enqueue_styles($hook) {
        // Only load on our plugin pages
        if (!$this->is_plugin_page($hook)) {
            return;
        }
        
        wp_enqueue_style(
            'super-speedy-compare-admin',
            SSC_PLUGIN_URL . 'admin/css/super-speedy-compare-admin.css',
            array(),
            SSC_VERSION,
            'all'
        );
    }

    /**
     * Register the JavaScript for the admin area
     */
    public function enqueue_scripts($hook) {
        // Debug logging
        error_log('SSC enqueue_scripts - Current page hook: ' . $hook . ' | GET page: ' . (isset($_GET['page']) ? $_GET['page'] : 'none'));
        
        // TEMPORARILY FORCE LOADING FOR DEBUGGING
        // Instead of checking hook, check if we're on one of our pages via GET
        if (isset($_GET['page']) && (
            $_GET['page'] === 'super-speedy-compare' || 
            $_GET['page'] === 'ssc-competitors' || 
            $_GET['page'] === 'ssc-features')) {
            
            error_log('SSC scripts loading for page: ' . $_GET['page']);
            
            // WordPress scripts
            wp_enqueue_media();
            
            // Common module (must be loaded first)
            wp_enqueue_script(
                'super-speedy-compare-common',
                SSC_PLUGIN_URL . 'admin/js/super-speedy-compare-common.js',
                array('jquery', 'wp-util'),
                time(),
                true
            );
            
            // Plugins module
            wp_enqueue_script(
                'super-speedy-compare-plugins',
                SSC_PLUGIN_URL . 'admin/js/super-speedy-compare-plugins.js',
                array('jquery', 'super-speedy-compare-common'),
                time(),
                true
            );
            
            // Competitors module
            wp_enqueue_script(
                'super-speedy-compare-competitors',
                SSC_PLUGIN_URL . 'admin/js/super-speedy-compare-competitors.js',
                array('jquery', 'super-speedy-compare-common'),
                time(),
                true
            );
            
            // Features module
            wp_enqueue_script(
                'super-speedy-compare-features',
                SSC_PLUGIN_URL . 'admin/js/super-speedy-compare-features.js',
                array('jquery', 'super-speedy-compare-common'),
                time(),
                true
            );
            
            // Main admin script (loads last to initialize modules)
            wp_enqueue_script(
                'super-speedy-compare-admin',
                SSC_PLUGIN_URL . 'admin/js/super-speedy-compare-admin.js',
                array(
                    'jquery',
                    'wp-util',
                    'super-speedy-compare-common',
                    'super-speedy-compare-plugins',
                    'super-speedy-compare-competitors',
                    'super-speedy-compare-features'
                ),
                time(),
                true
            );
            
            // Pass data to the script
            wp_localize_script(
                'super-speedy-compare-admin',
                'sscAdminVars',
                array(
                    'ajaxurl' => admin_url('admin-ajax.php'),
                    'nonce' => wp_create_nonce('super-speedy-compare-nonce'),
                    'strings' => array(
                        'saveSuccess' => __('Saved successfully!', 'super-speedy-compare'),
                        'saveError' => __('Error saving data. Please try again.', 'super-speedy-compare'),
                        'deleteConfirm' => __('Are you sure you want to delete this item? This cannot be undone.', 'super-speedy-compare'),
                        'deleteSuccess' => __('Deleted successfully!', 'super-speedy-compare'),
                        'deleteError' => __('Error deleting item. Please try again.', 'super-speedy-compare'),
                        'requiredField' => __('This field is required.', 'super-speedy-compare'),
                        'uploadImage' => __('Choose Image', 'super-speedy-compare'),
                        'useThisImage' => __('Use this image', 'super-speedy-compare'),
                        'unknown' => __('Unknown', 'super-speedy-compare')
                    )
                )
            );
        }
    }

    /**
     * Check if we're on a plugin page
     */
    public function is_plugin_page($hook) {
        // Add debugging
        error_log('Current admin hook: ' . $hook);
        
        // Original hook check
        $plugin_pages = array(
            'toplevel_page_super-speedy-compare',
            'super-speedy-compare_page_ssc-competitors',
            'super-speedy-compare_page_ssc-features'
        );
        
        // Check if hook matches any of our pages
        $is_defined_page = in_array($hook, $plugin_pages);
        
        // Also check by GET parameters to be extra thorough
        $is_custom_page = false;
        if (isset($_GET['page'])) {
            $page = $_GET['page'];
            $is_custom_page = ($page === 'super-speedy-compare' || 
                              $page === 'ssc-competitors' || 
                              $page === 'ssc-features');
        }
        
        // Return true if either condition is met
        return $is_defined_page || $is_custom_page;
    }

    /**
     * Add the admin menu
     */
    public function add_admin_menu() {
        add_menu_page(
            __('Super Speedy Compare', 'super-speedy-compare'),
            __('SS Compare', 'super-speedy-compare'),
            'manage_options',
            'super-speedy-compare',
            array($this, 'display_my_plugins_page'),
            'dashicons-chart-area',
            30
        );
        
        add_submenu_page(
            'super-speedy-compare',
            __('My Plugins', 'super-speedy-compare'),
            __('My Plugins', 'super-speedy-compare'),
            'manage_options',
            'super-speedy-compare',
            array($this, 'display_my_plugins_page')
        );
        
        add_submenu_page(
            'super-speedy-compare',
            __('Competitors', 'super-speedy-compare'),
            __('Competitors', 'super-speedy-compare'),
            'manage_options',
            'ssc-competitors',
            array($this, 'display_competitors_page')
        );
        
        add_submenu_page(
            'super-speedy-compare',
            __('Features', 'super-speedy-compare'),
            __('Features', 'super-speedy-compare'),
            'manage_options',
            'ssc-features',
            array($this, 'display_features_page')
        );
    }

    /**
     * Display the My Plugins page
     */
    public function display_my_plugins_page() {
        $my_plugins = Super_Speedy_Compare_DB::get_my_plugins();
        include_once SSC_PLUGIN_DIR . 'admin/partials/my-plugins-page.php';
    }

    /**
     * Display the Competitors page
     */
    public function display_competitors_page() {
        $my_plugins = Super_Speedy_Compare_DB::get_my_plugins();
        
        $selected_plugin_id = isset($_GET['plugin_id']) ? intval($_GET['plugin_id']) : 0;
        
        if ($selected_plugin_id && $my_plugin = Super_Speedy_Compare_DB::get_my_plugin($selected_plugin_id)) {
            $competitors = Super_Speedy_Compare_DB::get_competitors($selected_plugin_id);
            include_once SSC_PLUGIN_DIR . 'admin/partials/competitors-page.php';
        } else {
            include_once SSC_PLUGIN_DIR . 'admin/partials/select-plugin-page.php';
        }
    }

    /**
     * Display the Features page
     */
    public function display_features_page() {
        $my_plugins = Super_Speedy_Compare_DB::get_my_plugins();
        
        $selected_plugin_id = isset($_GET['plugin_id']) ? intval($_GET['plugin_id']) : 0;
        
        if ($selected_plugin_id && $my_plugin = Super_Speedy_Compare_DB::get_my_plugin($selected_plugin_id)) {
            // Get all the data needed for the features page
            $plugin_data = Super_Speedy_Compare_DB::get_comparison_data($selected_plugin_id);
            
            // If get_comparison_data failed or returned incomplete data, set up some defaults
            if (!$plugin_data) {
                $features = Super_Speedy_Compare_DB::get_features($selected_plugin_id);
                $competitors = Super_Speedy_Compare_DB::get_competitors($selected_plugin_id);
                $plugin_data = array(
                    'my_plugin' => $my_plugin,
                    'competitors' => $competitors,
                    'features' => $features,
                    'my_plugin_features' => array(),
                    'competitor_features' => array()
                );
            } else {
                $features = $plugin_data['features'];
                $competitors = $plugin_data['competitors'];
            }
            
            // Log for debugging
            error_log('Plugin data for features page: ' . print_r($plugin_data, true));
            
            include_once SSC_PLUGIN_DIR . 'admin/partials/features-page.php';
        } else {
            include_once SSC_PLUGIN_DIR . 'admin/partials/select-plugin-page.php';
        }
    }

    /**
     * AJAX handler for saving a plugin
     */
    public function save_my_plugin() {
        // Check nonce
        if (!check_ajax_referer('super-speedy-compare-nonce', 'nonce', false)) {
            wp_send_json_error(array('message' => __('Security check failed.', 'super-speedy-compare')));
        }
        
        // Check capability
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => __('You do not have permission to do this.', 'super-speedy-compare')));
        }
        
        // Validate required fields
        if (empty($_POST['name']) || empty($_POST['slug']) || empty($_POST['acronym'])) {
            wp_send_json_error(array('message' => __('Required fields are missing.', 'super-speedy-compare')));
        }
        
        // Prepare data
        $data = array(
            'name' => $_POST['name'],
            'slug' => $_POST['slug'],
            'acronym' => $_POST['acronym'],
            'description' => isset($_POST['description']) ? $_POST['description'] : '',
            'image_url' => isset($_POST['image_url']) ? $_POST['image_url'] : '',
            'sales_page_url' => isset($_POST['sales_page_url']) ? $_POST['sales_page_url'] : '',
            'price' => isset($_POST['price']) ? $_POST['price'] : ''
        );
        
        // Add ID if updating
        if (!empty($_POST['id'])) {
            $data['id'] = intval($_POST['id']);
        }
        
        // Save plugin
        $result = Super_Speedy_Compare_DB::save_my_plugin($data);
        
        if ($result) {
            $plugin_id = is_numeric($result) ? $result : $data['id'];
            $plugin = Super_Speedy_Compare_DB::get_my_plugin($plugin_id);
            
            wp_send_json_success(array(
                'message' => __('Plugin saved successfully.', 'super-speedy-compare'),
                'plugin' => $plugin
            ));
        } else {
            wp_send_json_error(array('message' => __('Error saving plugin.', 'super-speedy-compare')));
        }
    }

    /**
     * AJAX handler for deleting a plugin
     */
    public function delete_my_plugin() {
        // Check nonce
        if (!check_ajax_referer('super-speedy-compare-nonce', 'nonce', false)) {
            wp_send_json_error(array('message' => __('Security check failed.', 'super-speedy-compare')));
        }
        
        // Check capability
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => __('You do not have permission to do this.', 'super-speedy-compare')));
        }
        
        // Validate required fields
        if (empty($_POST['id'])) {
            wp_send_json_error(array('message' => __('Plugin ID is required.', 'super-speedy-compare')));
        }
        
        // Delete plugin
        $result = Super_Speedy_Compare_DB::delete_my_plugin(intval($_POST['id']));
        
        if ($result) {
            wp_send_json_success(array('message' => __('Plugin deleted successfully.', 'super-speedy-compare')));
        } else {
            wp_send_json_error(array('message' => __('Error deleting plugin.', 'super-speedy-compare')));
        }
    }

    /**
     * AJAX handler for saving a competitor
     */
    public function save_competitor() {
        global $wpdb;
        $wpdb->show_errors();
        
        // Debug info
        $debug_info = array(
            'post_data' => $_POST,
            'wpdb_last_error' => '',
            'wpdb_last_query' => ''
        );
        
        // Check nonce
        if (!check_ajax_referer('super-speedy-compare-nonce', 'nonce', false)) {
            $debug_info['error_point'] = 'nonce_check';
            wp_send_json_error(array(
                'message' => __('Security check failed.', 'super-speedy-compare'),
                'debug' => $debug_info
            ));
        }
        
        // Check capability
        if (!current_user_can('manage_options')) {
            $debug_info['error_point'] = 'capability_check';
            wp_send_json_error(array(
                'message' => __('You do not have permission to do this.', 'super-speedy-compare'),
                'debug' => $debug_info
            ));
        }
        
        // Validate required fields
        if (empty($_POST['my_plugin_id']) || empty($_POST['name']) || empty($_POST['slug'])) {
            $debug_info['error_point'] = 'required_fields';
            $debug_info['missing_fields'] = array(
                'my_plugin_id' => empty($_POST['my_plugin_id']),
                'name' => empty($_POST['name']),
                'slug' => empty($_POST['slug'])
            );
            wp_send_json_error(array(
                'message' => __('Required fields are missing.', 'super-speedy-compare'),
                'debug' => $debug_info
            ));
        }
        
        // Prepare data
        $data = array(
            'my_plugin_id' => intval($_POST['my_plugin_id']),
            'name' => $_POST['name'],
            'slug' => $_POST['slug'],
            'description' => isset($_POST['description']) ? $_POST['description'] : '',
            'image_url' => isset($_POST['image_url']) ? $_POST['image_url'] : '',
            'website_url' => isset($_POST['website_url']) ? $_POST['website_url'] : '',
            'affiliate_url' => isset($_POST['affiliate_url']) ? $_POST['affiliate_url'] : '',
            'price' => isset($_POST['price']) ? $_POST['price'] : ''
        );
        
        $debug_info['prepared_data'] = $data;
        
        // Add ID if updating
        if (!empty($_POST['id'])) {
            $data['id'] = intval($_POST['id']);
            $debug_info['updating_id'] = $data['id'];
        }
        
        // Save competitor
        $result = Super_Speedy_Compare_DB::save_competitor($data);
        $debug_info['db_result'] = $result;
        $debug_info['wpdb_last_error'] = $wpdb->last_error;
        $debug_info['wpdb_last_query'] = $wpdb->last_query;
        
        if ($result) {
            $competitor_id = is_numeric($result) ? $result : $data['id'];
            $competitor = Super_Speedy_Compare_DB::get_competitor($competitor_id);
            $debug_info['competitor'] = $competitor;
            
            wp_send_json_success(array(
                'message' => __('Competitor saved successfully.', 'super-speedy-compare'),
                'competitor' => $competitor,
                'debug' => $debug_info
            ));
        } else {
            wp_send_json_error(array(
                'message' => __('Error saving competitor.', 'super-speedy-compare'),
                'debug' => $debug_info
            ));
        }
    }

    /**
     * AJAX handler for deleting a competitor
     */
    public function delete_competitor() {
        // Check nonce
        if (!check_ajax_referer('super-speedy-compare-nonce', 'nonce', false)) {
            wp_send_json_error(array('message' => __('Security check failed.', 'super-speedy-compare')));
        }
        
        // Check capability
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => __('You do not have permission to do this.', 'super-speedy-compare')));
        }
        
        // Validate required fields
        if (empty($_POST['id'])) {
            wp_send_json_error(array('message' => __('Competitor ID is required.', 'super-speedy-compare')));
        }
        
        // Delete competitor
        $result = Super_Speedy_Compare_DB::delete_competitor(intval($_POST['id']));
        
        if ($result) {
            wp_send_json_success(array('message' => __('Competitor deleted successfully.', 'super-speedy-compare')));
        } else {
            wp_send_json_error(array('message' => __('Error deleting competitor.', 'super-speedy-compare')));
        }
    }

    /**
     * AJAX handler for saving a feature
     */
    public function save_feature() {
        global $wpdb;
        $wpdb->show_errors();
        
        // Debug info
        $debug_info = array(
            'post_data' => $_POST,
            'wpdb_last_error' => '',
            'wpdb_last_query' => ''
        );
        
        // Check nonce
        if (!check_ajax_referer('super-speedy-compare-nonce', 'nonce', false)) {
            $debug_info['error_point'] = 'nonce_check';
            wp_send_json_error(array(
                'message' => __('Security check failed.', 'super-speedy-compare'),
                'debug' => $debug_info
            ));
        }
        
        // Check capability
        if (!current_user_can('manage_options')) {
            $debug_info['error_point'] = 'capability_check';
            wp_send_json_error(array(
                'message' => __('You do not have permission to do this.', 'super-speedy-compare'),
                'debug' => $debug_info
            ));
        }
        
        // Validate required fields
        if (empty($_POST['my_plugin_id']) || empty($_POST['name'])) {
            $debug_info['error_point'] = 'required_fields';
            $debug_info['missing_fields'] = array(
                'my_plugin_id' => empty($_POST['my_plugin_id']),
                'name' => empty($_POST['name'])
            );
            wp_send_json_error(array(
                'message' => __('Required fields are missing.', 'super-speedy-compare'),
                'debug' => $debug_info
            ));
        }
        
        // Prepare data
        $data = array(
            'my_plugin_id' => intval($_POST['my_plugin_id']),
            'name' => $_POST['name'],
            'description' => isset($_POST['description']) ? $_POST['description'] : '',
            'order_num' => isset($_POST['order_num']) ? intval($_POST['order_num']) : 0
        );
        
        $debug_info['prepared_data'] = $data;
        
        // Add ID if updating
        if (!empty($_POST['id'])) {
            $data['id'] = intval($_POST['id']);
            $debug_info['updating_id'] = $data['id'];
        }
        
        // Save feature
        $result = Super_Speedy_Compare_DB::save_feature($data);
        $debug_info['db_result'] = $result;
        $debug_info['wpdb_last_error'] = $wpdb->last_error;
        $debug_info['wpdb_last_query'] = $wpdb->last_query;
        
        if ($result) {
            $feature_id = is_numeric($result) ? $result : $data['id'];
            $feature = Super_Speedy_Compare_DB::get_feature($feature_id);
            $debug_info['feature'] = $feature;
            
            wp_send_json_success(array(
                'message' => __('Feature saved successfully.', 'super-speedy-compare'),
                'feature' => $feature,
                'debug' => $debug_info
            ));
        } else {
            wp_send_json_error(array(
                'message' => __('Error saving feature.', 'super-speedy-compare'),
                'debug' => $debug_info
            ));
        }
    }

    /**
     * AJAX handler for deleting a feature
     */
    public function delete_feature() {
        // Check nonce
        if (!check_ajax_referer('super-speedy-compare-nonce', 'nonce', false)) {
            wp_send_json_error(array('message' => __('Security check failed.', 'super-speedy-compare')));
        }
        
        // Check capability
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => __('You do not have permission to do this.', 'super-speedy-compare')));
        }
        
        // Validate required fields
        if (empty($_POST['id'])) {
            wp_send_json_error(array('message' => __('Feature ID is required.', 'super-speedy-compare')));
        }
        
        // Delete feature
        $result = Super_Speedy_Compare_DB::delete_feature(intval($_POST['id']));
        
        if ($result) {
            wp_send_json_success(array('message' => __('Feature deleted successfully.', 'super-speedy-compare')));
        } else {
            wp_send_json_error(array('message' => __('Error deleting feature.', 'super-speedy-compare')));
        }
    }

    /**
     * AJAX handler for saving a plugin feature
     */
    public function save_plugin_feature() {
        // Check nonce
        if (!check_ajax_referer('super-speedy-compare-nonce', 'nonce', false)) {
            wp_send_json_error(array('message' => __('Security check failed.', 'super-speedy-compare')));
        }
        
        // Check capability
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => __('You do not have permission to do this.', 'super-speedy-compare')));
        }
        
        // Validate required fields
        if (
            empty($_POST['feature_id']) || 
            empty($_POST['plugin_id']) || 
            empty($_POST['plugin_type']) || 
            !isset($_POST['value']) || 
            empty($_POST['value_type'])
        ) {
            wp_send_json_error(array('message' => __('Required fields are missing.', 'super-speedy-compare')));
        }
        
        // Validate plugin type
        if (!in_array($_POST['plugin_type'], array('my_plugin', 'competitor'))) {
            wp_send_json_error(array('message' => __('Invalid plugin type.', 'super-speedy-compare')));
        }
        
        // Prepare data
        $data = array(
            'feature_id' => intval($_POST['feature_id']),
            'plugin_id' => intval($_POST['plugin_id']),
            'plugin_type' => $_POST['plugin_type'],
            'value' => $_POST['value'],
            'value_type' => $_POST['value_type']
        );
        
        // Save plugin feature
        $result = Super_Speedy_Compare_DB::save_plugin_feature($data);
        
        if ($result) {
            $plugin_feature = Super_Speedy_Compare_DB::get_plugin_feature(
                $data['feature_id'],
                $data['plugin_id'],
                $data['plugin_type']
            );
            
            wp_send_json_success(array(
                'message' => __('Feature value saved successfully.', 'super-speedy-compare'),
                'plugin_feature' => $plugin_feature
            ));
        } else {
            wp_send_json_error(array('message' => __('Error saving feature value.', 'super-speedy-compare')));
        }
    }

    /**
     * AJAX handler for getting plugin data
     */
    public function get_plugin_data() {
        // Check nonce
        if (!check_ajax_referer('super-speedy-compare-nonce', 'nonce', false)) {
            wp_send_json_error(array('message' => __('Security check failed.', 'super-speedy-compare')));
        }
        
        // Check capability
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => __('You do not have permission to do this.', 'super-speedy-compare')));
        }
        
        // Validate plugin ID
        if (empty($_POST['plugin_id'])) {
            wp_send_json_error(array('message' => __('Plugin ID is required.', 'super-speedy-compare')));
        }
        
        // Get plugin data
        $plugin_id = intval($_POST['plugin_id']);
        $plugin = Super_Speedy_Compare_DB::get_my_plugin($plugin_id);
        
        if (!$plugin) {
            wp_send_json_error(array('message' => __('Plugin not found.', 'super-speedy-compare')));
        }
        
        wp_send_json_success(array('plugin' => $plugin));
    }

    /**
     * AJAX handler for getting features
     */
    public function get_features() {
        // Check nonce
        if (!check_ajax_referer('super-speedy-compare-nonce', 'nonce', false)) {
            wp_send_json_error(array('message' => __('Security check failed.', 'super-speedy-compare')));
        }
        
        // Check capability
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => __('You do not have permission to do this.', 'super-speedy-compare')));
        }
        
        // Validate plugin ID
        if (empty($_POST['plugin_id'])) {
            wp_send_json_error(array('message' => __('Plugin ID is required.', 'super-speedy-compare')));
        }
        
        // Get features
        $plugin_id = intval($_POST['plugin_id']);
        $features = Super_Speedy_Compare_DB::get_features($plugin_id);
        
        wp_send_json_success(array('features' => $features));
    }

    /**
     * AJAX handler for getting competitors
     */
    public function get_competitors() {
        // Check nonce
        if (!check_ajax_referer('super-speedy-compare-nonce', 'nonce', false)) {
            wp_send_json_error(array('message' => __('Security check failed.', 'super-speedy-compare')));
        }
        
        // Check capability
        if (!current_user_can('manage_options')) {
            wp_send_json_error(array('message' => __('You do not have permission to do this.', 'super-speedy-compare')));
        }
        
        // Validate plugin ID
        if (empty($_POST['plugin_id'])) {
            wp_send_json_error(array('message' => __('Plugin ID is required.', 'super-speedy-compare')));
        }
        
        // Get competitors
        $plugin_id = intval($_POST['plugin_id']);
        $competitors = Super_Speedy_Compare_DB::get_competitors($plugin_id);
        
        wp_send_json_success(array('competitors' => $competitors));
    }
}