<?php
/**
 * Fired during plugin activation
 */
class Super_Speedy_Compare_Activator {

    /**
     * Activate the plugin
     * - Create the database tables
     */
    public static function activate() {
        self::create_tables();
    }

    /**
     * Create the necessary database tables
     */
    private static function create_tables() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();

        // Table for my plugins
        $table_my_plugins = $wpdb->prefix . 'ssc_my_plugins';
        
        // Table for competitors
        $table_competitors = $wpdb->prefix . 'ssc_competitors';
        
        // Table for features
        $table_features = $wpdb->prefix . 'ssc_features';
        
        // Table for plugin features (connects plugins/competitors to features with values)
        $table_plugin_features = $wpdb->prefix . 'ssc_plugin_features';

        // SQL for my plugins table
        $sql_my_plugins = "CREATE TABLE $table_my_plugins (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            name varchar(255) NOT NULL,
            slug varchar(100) NOT NULL,
            acronym varchar(20) NOT NULL,
            description text,
            image_url varchar(255),
            sales_page_url varchar(255),
            price varchar(100),
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            UNIQUE KEY slug (slug)
        ) $charset_collate;";

        // SQL for competitors table
        $sql_competitors = "CREATE TABLE $table_competitors (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            my_plugin_id mediumint(9) NOT NULL,
            name varchar(255) NOT NULL,
            slug varchar(100) NOT NULL,
            description text,
            image_url varchar(255),
            website_url varchar(255),
            affiliate_url varchar(255),
            price varchar(100),
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            KEY my_plugin_id (my_plugin_id)
        ) $charset_collate;";

        // SQL for features table
        $sql_features = "CREATE TABLE $table_features (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            my_plugin_id mediumint(9) NOT NULL,
            name varchar(255) NOT NULL,
            description text,
            order_num int DEFAULT 0,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            KEY my_plugin_id (my_plugin_id)
        ) $charset_collate;";

        // SQL for plugin features table
        $sql_plugin_features = "CREATE TABLE $table_plugin_features (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            feature_id mediumint(9) NOT NULL,
            plugin_id mediumint(9) NOT NULL,
            plugin_type enum('my_plugin', 'competitor') NOT NULL,
            value text NOT NULL,
            value_type enum('boolean', 'number', 'text') DEFAULT 'boolean',
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            UNIQUE KEY feature_plugin (feature_id, plugin_id, plugin_type),
            KEY feature_id (feature_id),
            KEY plugin_id (plugin_id)
        ) $charset_collate;";

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        
        // Create the tables
        dbDelta($sql_my_plugins);
        dbDelta($sql_competitors);
        dbDelta($sql_features);
        dbDelta($sql_plugin_features);
    }
}