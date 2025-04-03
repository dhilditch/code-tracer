<?php
/**
 * Admin page for managing my plugins
 */
?>
<div class="wrap ssc-admin-page">
    <div class="ssc-admin-header">
        <h1><?php _e('My Plugins', 'super-speedy-compare'); ?></h1>
        <p><?php _e('Manage your Super Speedy plugins for comparison.', 'super-speedy-compare'); ?></p>
    </div>
    
    <div class="ssc-card">
        <form id="ssc-my-plugin-form" class="ssc-form" method="post" 
              data-new-title="<?php _e('Add New Plugin', 'super-speedy-compare'); ?>"
              data-edit-title="<?php _e('Edit Plugin', 'super-speedy-compare'); ?>"
              data-new-button="<?php _e('Add Plugin', 'super-speedy-compare'); ?>"
              data-edit-button="<?php _e('Update Plugin', 'super-speedy-compare'); ?>">
            
            <h2><?php _e('Add New Plugin', 'super-speedy-compare'); ?></h2>
            
            <input type="hidden" name="nonce" value="<?php echo wp_create_nonce('super-speedy-compare-nonce'); ?>">
            <input type="hidden" name="id" value="">
            
            <div class="ssc-form-row">
                <label for="plugin-name"><?php _e('Plugin Name', 'super-speedy-compare'); ?> *</label>
                <input type="text" id="plugin-name" name="name" required>
                <p class="description"><?php _e('The name of your plugin (e.g., Super Speedy Search).', 'super-speedy-compare'); ?></p>
            </div>
            
            <div class="ssc-form-row">
                <label for="plugin-slug"><?php _e('Plugin Slug', 'super-speedy-compare'); ?> *</label>
                <input type="text" id="plugin-slug" name="slug" required>
                <p class="description"><?php _e('The slug of your plugin (e.g., super-speedy-search).', 'super-speedy-compare'); ?></p>
            </div>
            
            <div class="ssc-form-row">
                <label for="plugin-acronym"><?php _e('Plugin Acronym', 'super-speedy-compare'); ?> *</label>
                <input type="text" id="plugin-acronym" name="acronym" required>
                <p class="description"><?php _e('The acronym of your plugin (e.g., SSS).', 'super-speedy-compare'); ?></p>
            </div>
            
            <div class="ssc-form-row">
                <label for="plugin-description"><?php _e('Plugin Description', 'super-speedy-compare'); ?></label>
                <textarea id="plugin-description" name="description"></textarea>
                <p class="description"><?php _e('A brief description of your plugin.', 'super-speedy-compare'); ?></p>
            </div>
            
            <div class="ssc-form-row">
                <label for="plugin-image"><?php _e('Plugin Image', 'super-speedy-compare'); ?></label>
                <input type="hidden" class="ssc-image-url" name="image_url" id="plugin-image-url">
                <div class="ssc-media-preview"></div>
                <button class="button ssc-upload-image"><?php _e('Upload Image', 'super-speedy-compare'); ?></button>
                <button class="button ssc-remove-image"><?php _e('Remove Image', 'super-speedy-compare'); ?></button>
                <p class="description"><?php _e('An image or logo for your plugin.', 'super-speedy-compare'); ?></p>
            </div>
            
            <div class="ssc-form-row">
                <label for="plugin-sales-page"><?php _e('Sales Page URL', 'super-speedy-compare'); ?></label>
                <input type="url" id="plugin-sales-page" name="sales_page_url">
                <p class="description"><?php _e('The URL to the sales page for your plugin.', 'super-speedy-compare'); ?></p>
            </div>
            
            <div class="ssc-form-row">
                <label for="plugin-price"><?php _e('Price', 'super-speedy-compare'); ?></label>
                <input type="text" id="plugin-price" name="price">
                <p class="description"><?php _e('The price of your plugin (e.g., $49, $49/year).', 'super-speedy-compare'); ?></p>
            </div>
            
            <div class="ssc-form-row">
                <button type="submit" class="button button-primary ssc-submit-btn"><?php _e('Add Plugin', 'super-speedy-compare'); ?></button>
                <button type="button" class="button ssc-new-my-plugin-btn"><?php _e('New Plugin', 'super-speedy-compare'); ?></button>
            </div>
        </form>
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
                        
                        <?php if (!empty($plugin->price)) : ?>
                            <p><strong><?php _e('Price:', 'super-speedy-compare'); ?></strong> <?php echo esc_html($plugin->price); ?></p>
                        <?php endif; ?>
                        
                        <?php if (!empty($plugin->sales_page_url)) : ?>
                            <p>
                                <a href="<?php echo esc_url($plugin->sales_page_url); ?>" target="_blank">
                                    <?php _e('View Sales Page', 'super-speedy-compare'); ?>
                                </a>
                            </p>
                        <?php endif; ?>
                    </div>
                    
                    <div class="ssc-plugin-actions">
                        <button type="button" class="button ssc-edit-my-plugin" 
                                data-id="<?php echo esc_attr($plugin->id); ?>">
                            <?php _e('Edit', 'super-speedy-compare'); ?>
                        </button>
                        
                        <button type="button" class="button ssc-delete-my-plugin" 
                                data-id="<?php echo esc_attr($plugin->id); ?>">
                            <?php _e('Delete', 'super-speedy-compare'); ?>
                        </button>
                        
                        <a href="<?php echo admin_url('admin.php?page=ssc-competitors&plugin_id=' . $plugin->id); ?>" class="button">
                            <?php _e('Competitors', 'super-speedy-compare'); ?>
                        </a>
                        
                        <a href="<?php echo admin_url('admin.php?page=ssc-features&plugin_id=' . $plugin->id); ?>" class="button">
                            <?php _e('Features', 'super-speedy-compare'); ?>
                        </a>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    <?php else : ?>
        <div class="ssc-message">
            <?php _e('No plugins found. Add your first plugin using the form above.', 'super-speedy-compare'); ?>
        </div>
    <?php endif; ?>
</div>