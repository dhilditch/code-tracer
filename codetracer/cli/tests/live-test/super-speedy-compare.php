<?php
/**
 * Plugin Name: Super Speedy Compare
 * Plugin URI: https://superspeedyplugins.com/super-speedy-compare
 * Description: Compare Super Speedy plugins with competitors, featuring side-by-side comparison tables.
 * Version: 1.0.0
 * Author: Super Speedy Plugins
 * Author URI: https://superspeedyplugins.com
 * Text Domain: super-speedy-compare
 * Domain Path: /languages
 */ 

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('SSC_VERSION', '1.0.0');
define('SSC_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SSC_PLUGIN_URL', plugin_dir_url(__FILE__));
define('SSC_PLUGIN_BASENAME', plugin_basename(__FILE__));

// Include the main plugin class
require_once SSC_PLUGIN_DIR . 'includes/class-super-speedy-compare.php';

// Initialize the plugin
function ssc_initialize() {
    $plugin = new Super_Speedy_Compare();
    $plugin->init();
}
add_action('plugins_loaded', 'ssc_initialize');

// Register activation and deactivation hooks
register_activation_hook(__FILE__, 'ssc_activate');
register_deactivation_hook(__FILE__, 'ssc_deactivate');

/**
 * Plugin activation function
 */
function ssc_activate() {
    require_once SSC_PLUGIN_DIR . 'includes/class-super-speedy-compare-activator.php';
    Super_Speedy_Compare_Activator::activate();
}

/**
 * Plugin deactivation function
 */
function ssc_deactivate() {
    require_once SSC_PLUGIN_DIR . 'includes/class-super-speedy-compare-deactivator.php';
    Super_Speedy_Compare_Deactivator::deactivate();
}