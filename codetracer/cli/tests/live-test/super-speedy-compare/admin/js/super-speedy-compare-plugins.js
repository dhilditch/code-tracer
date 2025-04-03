(function($) {
    'use strict';

    // Plugins Admin JS Module
    window.SSC_Plugins = {
        // Initialize
        init: function() {
            this.bindEvents();
        },

        // Bind Events
        bindEvents: function() {
            // My Plugin Form - using event delegation
            $(document).on('submit', '#ssc-my-plugin-form', this.saveMyPlugin);
            
            // Delete Plugin
            $(document).on('click', '.ssc-delete-my-plugin', this.deleteMyPlugin);
            
            // Edit Plugin
            $(document).on('click', '.ssc-edit-my-plugin', this.editMyPlugin);
            
            // New Plugin button - using event delegation
            $(document).on('click', '.ssc-new-my-plugin-btn', this.newMyPlugin);
            
            // Plugin Feature Form - using event delegation
            $(document).on('submit', '.ssc-plugin-feature-form', this.savePluginFeature);
        },

        // Save My Plugin
        saveMyPlugin: function(e) {
            e.preventDefault();
            
            const form = $(this);
            const formData = new FormData(form[0]);
            formData.append('action', 'ssc_save_my_plugin');
            
            // Validate required fields
            if (!form.find('[name="name"]').val() || !form.find('[name="slug"]').val() || !form.find('[name="acronym"]').val()) {
                SSC_Common.showMessage(sscAdminVars.strings.requiredField, 'error');
                return;
            }
            
            // Show loading state
            form.find('.ssc-submit-btn').prop('disabled', true);
            
            // Send AJAX request
            $.ajax({
                url: sscAdminVars.ajaxurl,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function(response) {
                    if (response.success) {
                        SSC_Common.showMessage(response.data.message);
                        
                        // Reset form for adding new plugin
                        SSC_Common.resetForm(form);
                        
                        // Reload page to show the new plugin
                        location.reload();
                    } else {
                        SSC_Common.showMessage(response.data.message, 'error');
                    }
                },
                error: function(xhr, textStatus, errorThrown) {
                    console.error('AJAX Error:', xhr.responseText, textStatus, errorThrown);
                    SSC_Common.showMessage(sscAdminVars.strings.saveError + ' - Check console for details.', 'error');
                },
                complete: function() {
                    form.find('.ssc-submit-btn').prop('disabled', false);
                }
            });
        },

        // Save Plugin Feature
        savePluginFeature: function(e) {
            e.preventDefault();
            
            const form = $(this);
            const formData = new FormData(form[0]);
            formData.append('action', 'ssc_save_plugin_feature');
            
            // Show loading state
            form.find('.ssc-submit-btn').prop('disabled', true);
            
            // Send AJAX request
            $.ajax({
                url: sscAdminVars.ajaxurl,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function(response) {
                    if (response.success) {
                        SSC_Common.showMessage(response.data.message);
                    } else {
                        SSC_Common.showMessage(response.data.message, 'error');
                    }
                },
                error: function(xhr, textStatus, errorThrown) {
                    console.error('AJAX Error:', xhr.responseText, textStatus, errorThrown);
                    SSC_Common.showMessage(sscAdminVars.strings.saveError + ' - Check console for details.', 'error');
                },
                complete: function() {
                    form.find('.ssc-submit-btn').prop('disabled', false);
                }
            });
        },

        // Delete My Plugin
        deleteMyPlugin: function(e) {
            e.preventDefault();
            
            if (!confirm(sscAdminVars.strings.deleteConfirm)) {
                return;
            }
            
            const button = $(this);
            const pluginId = button.data('id');
            
            // Show loading state
            button.prop('disabled', true);
            
            // Send AJAX request
            $.ajax({
                url: sscAdminVars.ajaxurl,
                type: 'POST',
                data: {
                    action: 'ssc_delete_my_plugin',
                    id: pluginId,
                    nonce: sscAdminVars.nonce
                },
                success: function(response) {
                    if (response.success) {
                        SSC_Common.showMessage(response.data.message);
                        
                        // Remove plugin from list
                        button.closest('.ssc-plugin-card').remove();
                    } else {
                        SSC_Common.showMessage(response.data.message, 'error');
                    }
                },
                error: function(xhr, textStatus, errorThrown) {
                    console.error('AJAX Error:', xhr.responseText, textStatus, errorThrown);
                    SSC_Common.showMessage(sscAdminVars.strings.deleteError + ' - Check console for details.', 'error');
                },
                complete: function() {
                    button.prop('disabled', false);
                }
            });
        },

        // Edit My Plugin
        editMyPlugin: function(e) {
            e.preventDefault();
            
            const button = $(this);
            const pluginId = button.data('id');
            const form = $('#ssc-my-plugin-form');
            
            // Show loading state
            button.prop('disabled', true);
            
            // Send AJAX request to get plugin data
            $.ajax({
                url: sscAdminVars.ajaxurl,
                type: 'POST',
                data: {
                    action: 'ssc_get_plugin_data',
                    plugin_id: pluginId,
                    nonce: sscAdminVars.nonce
                },
                success: function(response) {
                    if (response.success) {
                        const plugin = response.data.plugin;
                        
                        // Update form
                        form.find('[name="id"]').val(plugin.id);
                        form.find('[name="name"]').val(plugin.name);
                        form.find('[name="slug"]').val(plugin.slug);
                        form.find('[name="acronym"]').val(plugin.acronym);
                        form.find('[name="description"]').val(plugin.description);
                        form.find('[name="price"]').val(plugin.price);
                        form.find('[name="sales_page_url"]').val(plugin.sales_page_url);
                        
                        // Update image preview
                        if (plugin.image_url) {
                            form.find('[name="image_url"]').val(plugin.image_url);
                            form.find('.ssc-media-preview').html('<img src="' + plugin.image_url + '" alt="">');
                        } else {
                            form.find('[name="image_url"]').val('');
                            form.find('.ssc-media-preview').empty();
                        }
                        
                        // Update form title and button text
                        form.find('h2').text(form.data('edit-title'));
                        form.find('.ssc-submit-btn').text(form.data('edit-button'));
                        
                        // Scroll to form
                        SSC_Common.scrollToForm(form);
                    } else {
                        SSC_Common.showMessage(response.data.message, 'error');
                    }
                },
                error: function(xhr, textStatus, errorThrown) {
                    console.error('AJAX Error:', xhr.responseText, textStatus, errorThrown);
                    SSC_Common.showMessage(sscAdminVars.strings.saveError + ' - Check console for details.', 'error');
                },
                complete: function() {
                    button.prop('disabled', false);
                }
            });
        },

        // New My Plugin
        newMyPlugin: function(e) {
            e.preventDefault();
            
            const form = $('#ssc-my-plugin-form');
            
            // Reset form
            SSC_Common.resetForm(form);
            
            // Scroll to form
            SSC_Common.scrollToForm(form);
        }
    };

})(jQuery);