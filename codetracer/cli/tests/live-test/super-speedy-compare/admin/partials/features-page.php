<?php
/**
 * Admin page for managing features and their values
 */
?>
<div class="wrap ssc-admin-page">
    <div class="ssc-admin-header">
        <h1>
            <?php printf(__('Features for %s', 'super-speedy-compare'), esc_html($my_plugin->name)); ?>
        </h1>
        <p>
            <?php _e('Manage features and set values for your plugin and competitors.', 'super-speedy-compare'); ?>
        </p>
    </div>
    
    <div class="ssc-tabs-wrapper">
        <div class="nav-tab-wrapper ssc-tabs-nav">
            <a href="#ssc-features-tab" class="nav-tab"><?php _e('Features List', 'super-speedy-compare'); ?></a>
            <a href="#ssc-add-feature-tab" class="nav-tab"><?php _e('Add/Edit Feature', 'super-speedy-compare'); ?></a>
            <a href="#ssc-feature-values-tab" class="nav-tab"><?php _e('Set Feature Values', 'super-speedy-compare'); ?></a>
        </div>
        
        <!-- Features List Tab -->
        <div id="ssc-features-tab" class="ssc-tab-content">
            <?php if (!empty($features)) : ?>
                <div class="ssc-card">
                    <h2><?php _e('Features', 'super-speedy-compare'); ?></h2>
                    
                    <table class="wp-list-table widefat fixed striped ssc-table">
                        <thead>
                            <tr>
                                <th width="40"><?php _e('Order', 'super-speedy-compare'); ?></th>
                                <th><?php _e('Feature Name', 'super-speedy-compare'); ?></th>
                                <th><?php _e('Description', 'super-speedy-compare'); ?></th>
                                <th class="ssc-actions"><?php _e('Actions', 'super-speedy-compare'); ?></th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($features as $feature) : ?>
                                <tr>
                                    <td><?php echo esc_html($feature->order_num); ?></td>
                                    <td>
                                        <strong><?php echo esc_html($feature->name); ?></strong>
                                    </td>
                                    <td><?php echo wp_kses_post($feature->description); ?></td>
                                    <td class="ssc-actions">
                                        <button type="button" class="button ssc-edit-feature" 
                                                data-id="<?php echo esc_attr($feature->id); ?>"
                                                data-name="<?php echo esc_attr($feature->name); ?>"
                                                data-description="<?php echo esc_attr($feature->description); ?>"
                                                data-order-num="<?php echo esc_attr($feature->order_num); ?>"
                                        >
                                            <?php _e('Edit', 'super-speedy-compare'); ?>
                                        </button>
                                        
                                        <button type="button" class="button ssc-delete-feature" 
                                                data-id="<?php echo esc_attr($feature->id); ?>">
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
                    <?php _e('No features found. Add your first feature using the Add/Edit Feature tab.', 'super-speedy-compare'); ?>
                </div>
            <?php endif; ?>
        </div>
        
        <!-- Add/Edit Feature Tab -->
        <div id="ssc-add-feature-tab" class="ssc-tab-content">
            <div class="ssc-card">
                <form id="ssc-feature-form" class="ssc-form" method="post"
                      data-new-title="<?php _e('Add New Feature', 'super-speedy-compare'); ?>"
                      data-edit-title="<?php _e('Edit Feature', 'super-speedy-compare'); ?>"
                      data-new-button="<?php _e('Add Feature', 'super-speedy-compare'); ?>"
                      data-edit-button="<?php _e('Update Feature', 'super-speedy-compare'); ?>">
                    
                    <h2><?php _e('Add New Feature', 'super-speedy-compare'); ?></h2>
                    
                    <input type="hidden" name="nonce" value="<?php echo wp_create_nonce('super-speedy-compare-nonce'); ?>">
                    <input type="hidden" name="id" value="">
                    <input type="hidden" name="my_plugin_id" value="<?php echo esc_attr($my_plugin->id); ?>">
                    
                    <div class="ssc-form-row">
                        <label for="feature-name"><?php _e('Feature Name', 'super-speedy-compare'); ?> *</label>
                        <input type="text" id="feature-name" name="name" required>
                        <p class="description"><?php _e('The name of the feature (e.g., Search Speed, Product Filtering).', 'super-speedy-compare'); ?></p>
                    </div>
                    
                    <div class="ssc-form-row">
                        <label for="feature-description"><?php _e('Description', 'super-speedy-compare'); ?></label>
                        <textarea id="feature-description" name="description"></textarea>
                        <p class="description"><?php _e('A brief description of what this feature is and why it matters.', 'super-speedy-compare'); ?></p>
                    </div>
                    
                    <div class="ssc-form-row">
                        <label for="feature-order"><?php _e('Order', 'super-speedy-compare'); ?></label>
                        <input type="number" id="feature-order" name="order_num" min="0" value="0">
                        <p class="description"><?php _e('The order in which this feature appears in the comparison table (lower numbers first).', 'super-speedy-compare'); ?></p>
                    </div>
                    
                    <div class="ssc-form-row">
                        <button type="submit" class="button button-primary ssc-submit-btn"><?php _e('Add Feature', 'super-speedy-compare'); ?></button>
                        <button type="button" class="button ssc-new-feature-btn"><?php _e('New Feature', 'super-speedy-compare'); ?></button>
                    </div>
                </form>
            </div>
        </div>
        
        <!-- Feature Values Tab -->
        <div id="ssc-feature-values-tab" class="ssc-tab-content">
            <?php if (empty($features)) : ?>
                <div class="ssc-message warning">
                    <?php _e('Please add features first before setting values.', 'super-speedy-compare'); ?>
                </div>
            <?php elseif (empty($competitors)) : ?>
                <div class="ssc-message warning">
                    <?php _e('Please add competitors first before setting feature values.', 'super-speedy-compare'); ?>
                    <p>
                        <a href="<?php echo admin_url('admin.php?page=ssc-competitors&plugin_id=' . $my_plugin->id); ?>" class="button">
                            <?php _e('Add Competitors', 'super-speedy-compare'); ?>
                        </a>
                    </p>
                </div>
            <?php else : ?>
                <!-- First set values for my plugin -->
                <div class="ssc-card">
                    <h2><?php printf(__('Feature Values for %s', 'super-speedy-compare'), esc_html($my_plugin->name)); ?></h2>
                    
                    <table class="wp-list-table widefat fixed striped ssc-table">
                        <thead>
                            <tr>
                                <th class="ssc-feature-name-col"><?php _e('Feature', 'super-speedy-compare'); ?></th>
                                <th class="ssc-feature-type-col"><?php _e('Value Type', 'super-speedy-compare'); ?></th>
                                <th class="ssc-feature-value-col"><?php _e('Value', 'super-speedy-compare'); ?></th>
                                <th class="ssc-actions"><?php _e('Action', 'super-speedy-compare'); ?></th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($features as $feature) : 
                                // Check if we already have a value for this feature
                                $feature_value = '';
                                $value_type = 'boolean';
                                
                                if (isset($plugin_data['my_plugin_features'][$feature->id])) {
                                    $feature_value = $plugin_data['my_plugin_features'][$feature->id]['value'];
                                    $value_type = $plugin_data['my_plugin_features'][$feature->id]['value_type'];
                                }
                                ?>
                                <tr>
                                    <td class="ssc-feature-name-col">
                                        <strong><?php echo esc_html($feature->name); ?></strong>
                                        <?php if (!empty($feature->description)) : ?>
                                            <p class="description"><?php echo wp_kses_post($feature->description); ?></p>
                                        <?php endif; ?>
                                    </td>
                                    <td class="ssc-feature-type-col">
                                        <form class="ssc-plugin-feature-form" method="post">
                                            <input type="hidden" name="nonce" value="<?php echo wp_create_nonce('super-speedy-compare-nonce'); ?>">
                                            <input type="hidden" name="feature_id" value="<?php echo esc_attr($feature->id); ?>">
                                            <input type="hidden" name="plugin_id" value="<?php echo esc_attr($my_plugin->id); ?>">
                                            <input type="hidden" name="plugin_type" value="my_plugin">
                                            
                                            <select name="value_type" class="ssc-feature-value-type">
                                                <option value="boolean" <?php selected($value_type, 'boolean'); ?>><?php _e('Yes/No', 'super-speedy-compare'); ?></option>
                                                <option value="number" <?php selected($value_type, 'number'); ?>><?php _e('Number', 'super-speedy-compare'); ?></option>
                                                <option value="text" <?php selected($value_type, 'text'); ?>><?php _e('Text', 'super-speedy-compare'); ?></option>
                                            </select>
                                    </td>
                                    <td class="ssc-feature-value-col">
                                            <?php if ($value_type === 'boolean') : ?>
                                                <select name="value" class="ssc-feature-value">
                                                    <option value="1" <?php selected($feature_value, '1'); ?>><?php _e('Yes', 'super-speedy-compare'); ?></option>
                                                    <option value="0" <?php selected($feature_value, '0'); ?>><?php _e('No', 'super-speedy-compare'); ?></option>
                                                </select>
                                            <?php elseif ($value_type === 'number') : ?>
                                                <input type="number" name="value" class="ssc-feature-value" value="<?php echo esc_attr($feature_value); ?>">
                                            <?php else : ?>
                                                <input type="text" name="value" class="ssc-feature-value" value="<?php echo esc_attr($feature_value); ?>">
                                            <?php endif; ?>
                                    </td>
                                    <td class="ssc-actions">
                                            <button type="submit" class="button ssc-submit-btn"><?php _e('Save', 'super-speedy-compare'); ?></button>
                                        </form>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
                
                <!-- Now show each competitor with features to set -->
                <?php foreach ($competitors as $competitor) : ?>
                    <div class="ssc-card">
                        <h2><?php printf(__('Feature Values for %s', 'super-speedy-compare'), esc_html($competitor->name)); ?></h2>
                        
                        <table class="wp-list-table widefat fixed striped ssc-table">
                            <thead>
                                <tr>
                                    <th class="ssc-feature-name-col"><?php _e('Feature', 'super-speedy-compare'); ?></th>
                                    <th class="ssc-feature-type-col"><?php _e('Value Type', 'super-speedy-compare'); ?></th>
                                    <th class="ssc-feature-value-col"><?php _e('Value', 'super-speedy-compare'); ?></th>
                                    <th class="ssc-actions"><?php _e('Action', 'super-speedy-compare'); ?></th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php 
                                foreach ($features as $feature) : 
                                    // Check if we already have a value for this feature
                                    $feature_value = '';
                                    $value_type = 'boolean';
                                    $missing_class = '';
                                    
                                    if (isset($plugin_data['competitor_features'][$competitor->id][$feature->id])) {
                                        $feature_value = $plugin_data['competitor_features'][$competitor->id][$feature->id]['value'];
                                        $value_type = $plugin_data['competitor_features'][$competitor->id][$feature->id]['value_type'];
                                    } else {
                                        // If no value, mark it as missing
                                        $missing_class = 'missing-feature';
                                    }
                                    ?>
                                    <tr class="<?php echo $missing_class; ?>">
                                        <td class="ssc-feature-name-col">
                                            <strong><?php echo esc_html($feature->name); ?></strong>
                                            <?php if (!empty($feature->description)) : ?>
                                                <p class="description"><?php echo wp_kses_post($feature->description); ?></p>
                                            <?php endif; ?>
                                        </td>
                                        <td class="ssc-feature-type-col">
                                            <form class="ssc-plugin-feature-form" method="post">
                                                <input type="hidden" name="nonce" value="<?php echo wp_create_nonce('super-speedy-compare-nonce'); ?>">
                                                <input type="hidden" name="feature_id" value="<?php echo esc_attr($feature->id); ?>">
                                                <input type="hidden" name="plugin_id" value="<?php echo esc_attr($competitor->id); ?>">
                                                <input type="hidden" name="plugin_type" value="competitor">
                                                
                                                <select name="value_type" class="ssc-feature-value-type">
                                                    <option value="boolean" <?php selected($value_type, 'boolean'); ?>><?php _e('Yes/No', 'super-speedy-compare'); ?></option>
                                                    <option value="number" <?php selected($value_type, 'number'); ?>><?php _e('Number', 'super-speedy-compare'); ?></option>
                                                    <option value="text" <?php selected($value_type, 'text'); ?>><?php _e('Text', 'super-speedy-compare'); ?></option>
                                                </select>
                                        </td>
                                        <td class="ssc-feature-value-col">
                                                <?php if ($value_type === 'boolean') : ?>
                                                    <select name="value" class="ssc-feature-value">
                                                        <option value="1" <?php selected($feature_value, '1'); ?>><?php _e('Yes', 'super-speedy-compare'); ?></option>
                                                        <option value="0" <?php selected($feature_value, '0'); ?>><?php _e('No', 'super-speedy-compare'); ?></option>
                                                    </select>
                                                <?php elseif ($value_type === 'number') : ?>
                                                    <input type="number" name="value" class="ssc-feature-value" value="<?php echo esc_attr($feature_value); ?>">
                                                <?php else : ?>
                                                    <input type="text" name="value" class="ssc-feature-value" value="<?php echo esc_attr($feature_value); ?>">
                                                <?php endif; ?>
                                        </td>
                                        <td class="ssc-actions">
                                                <button type="submit" class="button ssc-submit-btn"><?php _e('Save', 'super-speedy-compare'); ?></button>
                                            </form>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                <?php endforeach; ?>
            <?php endif; ?>
        </div>
    </div>
    
    <div class="ssc-admin-footer">
        <div class="ssc-actions">
            <a href="<?php echo admin_url('admin.php?page=super-speedy-compare'); ?>" class="button">
                <?php _e('Back to My Plugins', 'super-speedy-compare'); ?>
            </a>
            
            <a href="<?php echo admin_url('admin.php?page=ssc-competitors&plugin_id=' . $my_plugin->id); ?>" class="button">
                <?php _e('Manage Competitors', 'super-speedy-compare'); ?>
            </a>
        </div>
    </div>
</div>