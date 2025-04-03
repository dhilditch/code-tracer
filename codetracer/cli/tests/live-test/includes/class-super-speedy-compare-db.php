<?php
/**
 * Database handling class
 */
class Super_Speedy_Compare_DB {
    
    /**
     * Log errors to the error log
     * @param string $method The method name
     * @param mixed $data The data being processed
     * @param string $error The error message
     */
    private static function log_error($method, $data, $error) {
        error_log('Super Speedy Compare DB Error in ' . $method . ': ' . $error);
        error_log('Data: ' . print_r($data, true));
    }

    /**
     * Get all of my plugins
     * 
     * @return array Array of my plugins
     */
    public static function get_my_plugins() {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_my_plugins';
        
        return $wpdb->get_results("SELECT * FROM $table ORDER BY name ASC");
    }
    
    /**
     * Get a single plugin by ID
     * 
     * @param int $id Plugin ID
     * @return object|null Plugin object or null if not found
     */
    public static function get_my_plugin($id) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_my_plugins';
        
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id));
    }
    
    /**
     * Save my plugin
     * 
     * @param array $data Plugin data
     * @return int|false The number of rows updated, or false on error
     */
    public static function save_my_plugin($data) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_my_plugins';
        
        // Handle update
        if (!empty($data['id'])) {
            $result = $wpdb->update(
                $table,
                array(
                    'name' => sanitize_text_field($data['name']),
                    'slug' => sanitize_title($data['slug']),
                    'acronym' => sanitize_text_field($data['acronym']),
                    'description' => wp_kses_post($data['description']),
                    'image_url' => esc_url_raw($data['image_url']),
                    'sales_page_url' => esc_url_raw($data['sales_page_url']),
                    'price' => sanitize_text_field($data['price'])
                ),
                array('id' => $data['id']),
                array('%s', '%s', '%s', '%s', '%s', '%s', '%s'),
                array('%d')
            );
            
            return $result;
        }
        
        // Handle insert
        $result = $wpdb->insert(
            $table,
            array(
                'name' => sanitize_text_field($data['name']),
                'slug' => sanitize_title($data['slug']),
                'acronym' => sanitize_text_field($data['acronym']),
                'description' => wp_kses_post($data['description']),
                'image_url' => esc_url_raw($data['image_url']),
                'sales_page_url' => esc_url_raw($data['sales_page_url']),
                'price' => sanitize_text_field($data['price'])
            ),
            array('%s', '%s', '%s', '%s', '%s', '%s', '%s')
        );
        
        return $result ? $wpdb->insert_id : false;
    }
    
    /**
     * Delete my plugin
     * 
     * @param int $id Plugin ID
     * @return int|false The number of rows deleted, or false on error
     */
    public static function delete_my_plugin($id) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_my_plugins';
        
        // First delete related data
        self::delete_competitors_by_plugin($id);
        self::delete_features_by_plugin($id);
        
        // Then delete the plugin
        return $wpdb->delete($table, array('id' => $id), array('%d'));
    }
    
    /**
     * Get competitors for a specific plugin
     * 
     * @param int $my_plugin_id My plugin ID
     * @return array Array of competitors
     */
    public static function get_competitors($my_plugin_id) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_competitors';
        
        return $wpdb->get_results(
            $wpdb->prepare("SELECT * FROM $table WHERE my_plugin_id = %d ORDER BY name ASC", $my_plugin_id)
        );
    }
    
    /**
     * Get a single competitor
     * 
     * @param int $id Competitor ID
     * @return object|null Competitor object or null if not found
     */
    public static function get_competitor($id) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_competitors';
        
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id));
    }
    
    /**
     * Save competitor
     *
     * @param array $data Competitor data
     * @return int|false The number of rows updated, or false on error
     */
    public static function save_competitor($data) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_competitors';
        
        // Handle update
        if (!empty($data['id'])) {
            $result = $wpdb->update(
                $table,
                array(
                    'my_plugin_id' => absint($data['my_plugin_id']),
                    'name' => sanitize_text_field($data['name']),
                    'slug' => sanitize_title($data['slug']),
                    'description' => wp_kses_post($data['description']),
                    'image_url' => esc_url_raw($data['image_url']),
                    'website_url' => esc_url_raw($data['website_url']),
                    'affiliate_url' => esc_url_raw($data['affiliate_url']),
                    'price' => sanitize_text_field($data['price'])
                ),
                array('id' => $data['id']),
                array('%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s'),
                array('%d')
            );
            
            if (false === $result) {
                self::log_error('save_competitor (update)', $data, $wpdb->last_error);
            }
            
            return $result;
        }
        
        // Handle insert
        $result = $wpdb->insert(
            $table,
            array(
                'my_plugin_id' => absint($data['my_plugin_id']),
                'name' => sanitize_text_field($data['name']),
                'slug' => sanitize_title($data['slug']),
                'description' => wp_kses_post($data['description']),
                'image_url' => esc_url_raw($data['image_url']),
                'website_url' => esc_url_raw($data['website_url']),
                'affiliate_url' => esc_url_raw($data['affiliate_url']),
                'price' => sanitize_text_field($data['price'])
            ),
            array('%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s')
        );
        
        if (false === $result) {
            self::log_error('save_competitor (insert)', $data, $wpdb->last_error);
        }
        
        return $result ? $wpdb->insert_id : false;
    }
    
    /**
     * Delete competitor
     * 
     * @param int $id Competitor ID
     * @return int|false The number of rows deleted, or false on error
     */
    public static function delete_competitor($id) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_competitors';
        
        // Get the competitor to determine plugin type for deleting features
        $competitor = self::get_competitor($id);
        if ($competitor) {
            // Delete related feature values
            self::delete_plugin_features($id, 'competitor');
        }
        
        // Delete the competitor
        return $wpdb->delete($table, array('id' => $id), array('%d'));
    }
    
    /**
     * Delete all competitors for a plugin
     * 
     * @param int $my_plugin_id My plugin ID
     * @return int|false The number of rows deleted, or false on error
     */
    public static function delete_competitors_by_plugin($my_plugin_id) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_competitors';
        
        // Get all competitors for this plugin
        $competitors = self::get_competitors($my_plugin_id);
        
        // Delete feature values for each competitor
        foreach ($competitors as $competitor) {
            self::delete_plugin_features($competitor->id, 'competitor');
        }
        
        // Delete competitors
        return $wpdb->delete($table, array('my_plugin_id' => $my_plugin_id), array('%d'));
    }
    
    /**
     * Get features for a specific plugin
     * 
     * @param int $my_plugin_id My plugin ID
     * @return array Array of features
     */
    public static function get_features($my_plugin_id) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_features';
        
        return $wpdb->get_results(
            $wpdb->prepare("SELECT * FROM $table WHERE my_plugin_id = %d ORDER BY order_num ASC, name ASC", $my_plugin_id)
        );
    }
    
    /**
     * Get a single feature
     * 
     * @param int $id Feature ID
     * @return object|null Feature object or null if not found
     */
    public static function get_feature($id) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_features';
        
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id));
    }
    
    /**
     * Save feature
     *
     * @param array $data Feature data
     * @return int|false The number of rows updated, or false on error
     */
    public static function save_feature($data) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_features';
        
        // Handle update
        if (!empty($data['id'])) {
            $result = $wpdb->update(
                $table,
                array(
                    'my_plugin_id' => absint($data['my_plugin_id']),
                    'name' => sanitize_text_field($data['name']),
                    'description' => wp_kses_post($data['description']),
                    'order_num' => absint($data['order_num'])
                ),
                array('id' => $data['id']),
                array('%d', '%s', '%s', '%d'),
                array('%d')
            );
            
            if (false === $result) {
                self::log_error('save_feature (update)', $data, $wpdb->last_error);
            }
            
            return $result;
        }
        
        // Handle insert
        $result = $wpdb->insert(
            $table,
            array(
                'my_plugin_id' => absint($data['my_plugin_id']),
                'name' => sanitize_text_field($data['name']),
                'description' => wp_kses_post($data['description']),
                'order_num' => absint($data['order_num'])
            ),
            array('%d', '%s', '%s', '%d')
        );
        
        if (false === $result) {
            self::log_error('save_feature (insert)', $data, $wpdb->last_error);
        }
        
        return $result ? $wpdb->insert_id : false;
    }
    
    /**
     * Delete feature
     * 
     * @param int $id Feature ID
     * @return int|false The number of rows deleted, or false on error
     */
    public static function delete_feature($id) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_features';
        
        // Delete related feature values
        self::delete_plugin_features_by_feature($id);
        
        // Delete the feature
        return $wpdb->delete($table, array('id' => $id), array('%d'));
    }
    
    /**
     * Delete all features for a plugin
     * 
     * @param int $my_plugin_id My plugin ID
     * @return int|false The number of rows deleted, or false on error
     */
    public static function delete_features_by_plugin($my_plugin_id) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_features';
        
        // Get all features for this plugin
        $features = self::get_features($my_plugin_id);
        
        // Delete feature values for each feature
        foreach ($features as $feature) {
            self::delete_plugin_features_by_feature($feature->id);
        }
        
        // Delete features
        return $wpdb->delete($table, array('my_plugin_id' => $my_plugin_id), array('%d'));
    }
    
    /**
     * Get plugin feature value
     * 
     * @param int $feature_id Feature ID
     * @param int $plugin_id Plugin ID
     * @param string $plugin_type Plugin type (my_plugin or competitor)
     * @return object|null Plugin feature object or null if not found
     */
    public static function get_plugin_feature($feature_id, $plugin_id, $plugin_type) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_plugin_features';
        
        return $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM $table WHERE feature_id = %d AND plugin_id = %d AND plugin_type = %s",
                $feature_id, $plugin_id, $plugin_type
            )
        );
    }
    
    /**
     * Get all plugin features for a specific plugin
     * 
     * @param int $plugin_id Plugin ID
     * @param string $plugin_type Plugin type (my_plugin or competitor)
     * @return array Array of plugin features
     */
    public static function get_plugin_features($plugin_id, $plugin_type) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_plugin_features';
        
        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM $table WHERE plugin_id = %d AND plugin_type = %s",
                $plugin_id, $plugin_type
            )
        );
    }
    
    /**
     * Save plugin feature
     *
     * @param array $data Plugin feature data
     * @return int|false The number of rows updated, or false on error
     */
    public static function save_plugin_feature($data) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_plugin_features';
        
        // Debug log
        error_log('Saving plugin feature: ' . print_r($data, true));
        
        // Check if this feature already exists
        $existing = self::get_plugin_feature(
            $data['feature_id'],
            $data['plugin_id'],
            $data['plugin_type']
        );
        
        // Handle update
        if ($existing) {
            $result = $wpdb->update(
                $table,
                array(
                    'value' => sanitize_text_field($data['value']),
                    'value_type' => sanitize_text_field($data['value_type'])
                ),
                array(
                    'feature_id' => $data['feature_id'],
                    'plugin_id' => $data['plugin_id'],
                    'plugin_type' => $data['plugin_type']
                ),
                array('%s', '%s'),
                array('%d', '%d', '%s')
            );
            
            if (false === $result) {
                self::log_error('save_plugin_feature (update)', $data, $wpdb->last_error);
            }
            
            return $result;
        }
        
        // Handle insert
        $result = $wpdb->insert(
            $table,
            array(
                'feature_id' => absint($data['feature_id']),
                'plugin_id' => absint($data['plugin_id']),
                'plugin_type' => sanitize_text_field($data['plugin_type']),
                'value' => sanitize_text_field($data['value']),
                'value_type' => sanitize_text_field($data['value_type'])
            ),
            array('%d', '%d', '%s', '%s', '%s')
        );
        
        if (false === $result) {
            self::log_error('save_plugin_feature (insert)', $data, $wpdb->last_error);
        }
        
        return $result ? $wpdb->insert_id : false;
    }
    
    /**
     * Delete plugin feature
     * 
     * @param int $plugin_id Plugin ID
     * @param string $plugin_type Plugin type (my_plugin or competitor)
     * @return int|false The number of rows deleted, or false on error
     */
    public static function delete_plugin_features($plugin_id, $plugin_type) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_plugin_features';
        
        return $wpdb->delete(
            $table,
            array(
                'plugin_id' => $plugin_id,
                'plugin_type' => $plugin_type
            ),
            array('%d', '%s')
        );
    }
    
    /**
     * Delete plugin features by feature
     * 
     * @param int $feature_id Feature ID
     * @return int|false The number of rows deleted, or false on error
     */
    public static function delete_plugin_features_by_feature($feature_id) {
        global $wpdb;
        $table = $wpdb->prefix . 'ssc_plugin_features';
        
        return $wpdb->delete($table, array('feature_id' => $feature_id), array('%d'));
    }
    
    /**
     * Get comparison data for a plugin group
     * 
     * @param int $my_plugin_id My plugin ID
     * @return array Comparison data
     */
    public static function get_comparison_data($my_plugin_id) {
        $my_plugin = self::get_my_plugin($my_plugin_id);
        if (!$my_plugin) {
            return false;
        }
        
        $competitors = self::get_competitors($my_plugin_id);
        $features = self::get_features($my_plugin_id);
        
        // Get feature values for my plugin
        $my_plugin_feature_values = array();
        $my_plugin_features = self::get_plugin_features($my_plugin_id, 'my_plugin');
        foreach ($my_plugin_features as $pf) {
            $my_plugin_feature_values[$pf->feature_id] = array(
                'value' => $pf->value,
                'value_type' => $pf->value_type
            );
        }
        
        // Get feature values for competitors
        $competitor_feature_values = array();
        foreach ($competitors as $competitor) {
            $competitor_feature_values[$competitor->id] = array();
            $competitor_features = self::get_plugin_features($competitor->id, 'competitor');
            foreach ($competitor_features as $pf) {
                $competitor_feature_values[$competitor->id][$pf->feature_id] = array(
                    'value' => $pf->value,
                    'value_type' => $pf->value_type
                );
            }
        }
        
        return array(
            'my_plugin' => $my_plugin,
            'competitors' => $competitors,
            'features' => $features,
            'my_plugin_features' => $my_plugin_feature_values,
            'competitor_features' => $competitor_feature_values
        );
    }
}