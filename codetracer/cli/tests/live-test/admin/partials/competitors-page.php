<?php
/**
 * Admin page for managing competitors
 */
?>
<div class="wrap ssc-admin-page">
    <div class="ssc-admin-header">
        <h1>
            <?php printf(__('Competitors for %s', 'super-speedy-compare'), esc_html($my_plugin->name)); ?>
        </h1>
        <p>
            <?php _e('Manage competitor plugins to compare with', 'super-speedy-compare'); ?> 
            <strong><?php echo esc_html($my_plugin->name); ?></strong>
        </p>
    </div>
    
    <div class="ssc-card">
        <form id="ssc-competitor-form" class="ssc-form" method="post"
              data-new-title="<?php _e('Add New Competitor', 'super-speedy-compare'); ?>"
              data-edit-title="<?php _e('Edit Competitor', 'super-speedy-compare'); ?>"
              data-new-button="<?php _e('Add Competitor', 'super-speedy-compare'); ?>"
              data-edit-button="<?php _e('Update Competitor', 'super-speedy-compare'); ?>">
            
            <h2><?php _e('Add New Competitor', 'super-speedy-compare'); ?></h2>
            
            <input type="hidden" name="nonce" value="<?php echo wp_create_nonce('super-speedy-compare-nonce'); ?>">
            <input type="hidden" name="id" value="">
            <input type="hidden" name="my_plugin_id" value="<?php echo esc_attr($my_plugin->id); ?>">
            
            <div class="ssc-form-row">
                <label for="competitor-name"><?php _e('Competitor Name', 'super-speedy-compare'); ?> *</label>
                <input type="text" id="competitor-name" name="name" required>
                <p class="description"><?php _e('The name of the competitor plugin.', 'super-speedy-compare'); ?></p>
            </div>
            
            <div class="ssc-form-row">
                <label for="competitor-slug"><?php _e('Competitor Slug', 'super-speedy-compare'); ?> *</label>
                <input type="text" id="competitor-slug" name="slug" required>
                <p class="description"><?php _e('The slug of the competitor plugin (e.g., fibosearch).', 'super-speedy-compare'); ?></p>
            </div>
            
            <div class="ssc-form-row">
                <label for="competitor-description"><?php _e('Description', 'super-speedy-compare'); ?></label>
                <textarea id="competitor-description" name="description"></textarea>
                <p class="description"><?php _e('A brief description of the competitor plugin.', 'super-speedy-compare'); ?></p>
            </div>
            
            <div class="ssc-form-row">
                <label for="competitor-image"><?php _e('Plugin Image', 'super-speedy-compare'); ?></label>
                <input type="hidden" class="ssc-image-url" name="image_url" id="competitor-image-url">
                <div class="ssc-media-preview"></div>
                <button class="button ssc-upload-image"><?php _e('Upload Image', 'super-speedy-compare'); ?></button>
                <button class="button ssc-remove-image"><?php _e('Remove Image', 'super-speedy-compare'); ?></button>
                <p class="description"><?php _e('An image or logo for the competitor plugin.', 'super-speedy-compare'); ?></p>
            </div>
            
            <div class="ssc-form-row">
                <label for="competitor-website"><?php _e('Website URL', 'super-speedy-compare'); ?></label>
                <input type="url" id="competitor-website" name="website_url">
                <p class="description"><?php _e('The URL to the competitor website.', 'super-speedy-compare'); ?></p>
            </div>
            
            <div class="ssc-form-row">
                <label for="competitor-affiliate"><?php _e('Affiliate URL', 'super-speedy-compare'); ?></label>
                <input type="url" id="competitor-affiliate" name="affiliate_url">
                <p class="description"><?php _e('Your affiliate link for the competitor (optional).', 'super-speedy-compare'); ?></p>
            </div>
            
            <div class="ssc-form-row">
                <label for="competitor-price"><?php _e('Price', 'super-speedy-compare'); ?></label>
                <input type="text" id="competitor-price" name="price">
                <p class="description"><?php _e('The price of the competitor plugin (e.g., $49, $49/year).', 'super-speedy-compare'); ?></p>
            </div>
            
            <div class="ssc-form-row">
                <button type="button" class="button button-primary ssc-submit-btn" id="add-competitor-btn"><?php _e('Add Competitor', 'super-speedy-compare'); ?></button>
                <button type="button" class="button ssc-new-competitor-btn"><?php _e('New Competitor', 'super-speedy-compare'); ?></button>
            </div>
        </form>
    </div>
    
    <?php if (!empty($competitors)) : ?>
        <div class="ssc-card">
            <h2><?php _e('Competitors', 'super-speedy-compare'); ?></h2>
            
            <table class="wp-list-table widefat fixed striped ssc-table">
                <thead>
                    <tr>
                        <th><?php _e('Image', 'super-speedy-compare'); ?></th>
                        <th><?php _e('Name', 'super-speedy-compare'); ?></th>
                        <th><?php _e('Description', 'super-speedy-compare'); ?></th>
                        <th><?php _e('Price', 'super-speedy-compare'); ?></th>
                        <th class="ssc-actions"><?php _e('Actions', 'super-speedy-compare'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($competitors as $competitor) : ?>
                        <tr>
                            <td width="60">
                                <?php if (!empty($competitor->image_url)) : ?>
                                    <img src="<?php echo esc_url($competitor->image_url); ?>" alt="<?php echo esc_attr($competitor->name); ?>" style="max-width: 50px; max-height: 50px;">
                                <?php endif; ?>
                            </td>
                            <td>
                                <strong><?php echo esc_html($competitor->name); ?></strong>
                                <?php if (!empty($competitor->website_url)) : ?>
                                    <div>
                                        <a href="<?php echo esc_url($competitor->website_url); ?>" target="_blank"><?php _e('Visit Website', 'super-speedy-compare'); ?></a>
                                    </div>
                                <?php endif; ?>
                            </td>
                            <td><?php echo wp_kses_post($competitor->description); ?></td>
                            <td><?php echo esc_html($competitor->price); ?></td>
                            <td class="ssc-actions">
                                <button type="button" class="button ssc-edit-competitor" 
                                        data-id="<?php echo esc_attr($competitor->id); ?>"
                                        data-name="<?php echo esc_attr($competitor->name); ?>"
                                        data-slug="<?php echo esc_attr($competitor->slug); ?>"
                                        data-description="<?php echo esc_attr($competitor->description); ?>"
                                        data-image-url="<?php echo esc_attr($competitor->image_url); ?>"
                                        data-website-url="<?php echo esc_attr($competitor->website_url); ?>"
                                        data-affiliate-url="<?php echo esc_attr($competitor->affiliate_url); ?>"
                                        data-price="<?php echo esc_attr($competitor->price); ?>"
                                >
                                    <?php _e('Edit', 'super-speedy-compare'); ?>
                                </button>
                                
                                <button type="button" class="button ssc-delete-competitor" 
                                        data-id="<?php echo esc_attr($competitor->id); ?>">
                                    <?php _e('Delete', 'super-speedy-compare'); ?>
                                </button>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php else : ?>
        <div class="ssc-message">
            <?php _e('No competitors found. Add your first competitor using the form above.', 'super-speedy-compare'); ?>
        </div>
    <?php endif; ?>
    
    <div class="ssc-admin-footer">
        <div class="ssc-actions">
            <a href="<?php echo admin_url('admin.php?page=super-speedy-compare'); ?>" class="button">
                <?php _e('Back to My Plugins', 'super-speedy-compare'); ?>
            </a>
            
            <a href="<?php echo admin_url('admin.php?page=ssc-features&plugin_id=' . $my_plugin->id); ?>" class="button">
                <?php _e('Manage Features', 'super-speedy-compare'); ?>
            </a>
        </div>
    </div>
</div>