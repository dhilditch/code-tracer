<?php
/**
 * Template for plugin selection
 */
?>
<div class="wrap ssc-admin-page">
    <div class="ssc-admin-header">
        <h1><?php _e('Select a Plugin', 'super-speedy-compare'); ?></h1>
        <p><?php _e('Please select one of your plugins to continue.', 'super-speedy-compare'); ?></p>
    </div>
    
    <?php if (!empty($my_plugins)) : ?>
        <div class="ssc-plugins-list">
            <?php foreach ($my_plugins as $plugin) : ?>
                <div class="ssc-plugin-card">
                    <h3><?php echo esc_html($plugin->name); ?> (<?php echo esc_html($plugin->acronym); ?>)</h3>
                    
                    <?php if (!empty($plugin->image_url)) : ?>
                        <div class="ssc-plugin-image">
                            <img src="<?php echo esc_url($plugin->image_url); ?>" alt="<?php echo esc_attr($plugin->name); ?>">
                        </div>
                    <?php endif; ?>
                    
                    <div class="ssc-plugin-details">
                        <?php if (!empty($plugin->description)) : ?>
                            <p><?php echo wp_kses_post($plugin->description); ?></p>
                        <?php endif; ?>
                    </div>
                    
                    <div class="ssc-plugin-actions">
                        <?php
                        // Create the correct URL based on which page we're on
                        $page = isset($_GET['page']) ? sanitize_text_field($_GET['page']) : '';
                        $url = admin_url('admin.php?page=' . $page . '&plugin_id=' . $plugin->id);
                        ?>
                        
                        <a href="<?php echo esc_url($url); ?>" class="button button-primary">
                            <?php _e('Select', 'super-speedy-compare'); ?>
                        </a>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    <?php else : ?>
        <div class="ssc-message warning">
            <?php _e('No plugins found. Please add your plugins in the My Plugins section first.', 'super-speedy-compare'); ?>
            <p>
                <a href="<?php echo admin_url('admin.php?page=super-speedy-compare'); ?>" class="button">
                    <?php _e('Go to My Plugins', 'super-speedy-compare'); ?>
                </a>
            </p>
        </div>
    <?php endif; ?>
</div>