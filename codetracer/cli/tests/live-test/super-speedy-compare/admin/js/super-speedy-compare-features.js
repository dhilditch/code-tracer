(function($) {
    'use strict';

    // Features Admin JS Module
    window.SSC_Features = {
        // Initialize
        init: function() {
            this.bindEvents();
        },

        // Bind Events
        bindEvents: function() {
            // Feature Form - using event delegation
            $(document).on('submit', '#ssc-feature-form', function(e) {
                console.log('EVENT: Feature form submit');
                SSC_Features.saveFeature(e);
            });
            
            // Delete Feature
            $(document).on('click', '.ssc-delete-feature', function(e) {
                console.log('EVENT: Delete feature click');
                SSC_Features.deleteFeature(e);
            });
            
            // Edit Feature
            $(document).on('click', '.ssc-edit-feature', function(e) {
                console.log('EVENT: Edit feature click');
                SSC_Features.editFeature(e);
            });
            
            // New Feature button - using event delegation
            $(document).on('click', '.ssc-new-feature-btn', function(e) {
                console.log('EVENT: New feature button click');
                SSC_Features.newFeature(e);
            });
            
            // Plugin Feature Form - using event delegation
            $(document).on('submit', '.ssc-plugin-feature-form', function(e) {
                console.log('EVENT: Plugin feature form submit');
                e.preventDefault();
                
                const form = $(this);
                const formData = new FormData(form[0]);
                formData.append('action', 'ssc_save_plugin_feature');
                
                // Show loading state
                form.closest('tr').find('.ssc-submit-btn').prop('disabled', true);
                
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
                        form.closest('tr').find('.ssc-submit-btn').prop('disabled', false);
                    }
                });
            });
            
            // Feature type change - Using CSS class selectors rather than positional indexing
            $(document).on('change', '.ssc-feature-value-type', function(e) {
                console.log('EVENT: Feature value type change');
                
                // Get the current select element and its value
                const select = $(this);
                const valueType = select.val();
                console.log('Value type changed to:', valueType);
                
                // Find the parent row
                const row = select.closest('tr');
                
                // Find the value cell using the class selector we added
                const valueCell = row.find('.ssc-feature-value-col');
                console.log('Found value cell:', valueCell.length > 0);
                
                // Find the value field within the value cell
                const valueField = valueCell.find('.ssc-feature-value');
                console.log('Found value field:', valueField.length > 0);
                
                // Get the current value
                const currentVal = valueField.val() || '';
                console.log('Current value:', currentVal);
                
                // Create the appropriate replacement HTML based on type
                let html = '';
                if (valueType === 'boolean') {
                    html = '<select name="value" class="ssc-feature-value">' +
                        '<option value="1"' + (currentVal === '1' ? ' selected' : '') + '>Yes</option>' +
                        '<option value="0"' + (currentVal === '0' ? ' selected' : '') + '>No</option>' +
                        '</select>';
                } else if (valueType === 'number') {
                    html = '<input type="number" name="value" class="ssc-feature-value" value="' + currentVal + '">';
                } else {
                    html = '<input type="text" name="value" class="ssc-feature-value" value="' + currentVal + '">';
                }
                
                // Replace the field
                valueField.replaceWith(html);
                console.log('Value field replaced with type:', valueType);
            });
        },

        // Save Feature
        saveFeature: function(e) {
            e.preventDefault();
            
            const form = $(e.target);
            const formData = new FormData(form[0]);
            formData.append('action', 'ssc_save_feature');
            
            // Validate required fields
            if (!form.find('[name="name"]').val()) {
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
                        
                        // Reset form for adding new feature
                        SSC_Common.resetForm(form);
                        
                        // Reload page to show the new feature
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

        // Delete Feature
        deleteFeature: function(e) {
            e.preventDefault();
            
            if (!confirm(sscAdminVars.strings.deleteConfirm)) {
                return;
            }
            
            const button = $(e.target);
            const featureId = button.data('id');
            
            // Show loading state
            button.prop('disabled', true);
            
            // Send AJAX request
            $.ajax({
                url: sscAdminVars.ajaxurl,
                type: 'POST',
                data: {
                    action: 'ssc_delete_feature',
                    id: featureId,
                    nonce: sscAdminVars.nonce
                },
                success: function(response) {
                    if (response.success) {
                        SSC_Common.showMessage(response.data.message);
                        
                        // Remove feature from list
                        button.closest('tr, .ssc-feature-card').remove();
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

        // Edit Feature
        editFeature: function(e) {
            e.preventDefault();
            
            const button = $(e.target);
            const featureId = button.data('id');
            const form = $('#ssc-feature-form');
            
            // Get feature data from button's data attributes
            const feature = {
                id: featureId,
                name: button.data('name'),
                description: button.data('description'),
                order_num: button.data('order-num')
            };
            
            // Update form
            form.find('[name="id"]').val(feature.id);
            form.find('[name="name"]').val(feature.name);
            form.find('[name="description"]').val(feature.description);
            form.find('[name="order_num"]').val(feature.order_num);
            
            // Update form title and button text
            form.find('h2').text(form.data('edit-title'));
            form.find('.ssc-submit-btn').text(form.data('edit-button'));
            
            // Scroll to form
            SSC_Common.scrollToForm(form);
        },

        // New Feature
        newFeature: function(e) {
            e.preventDefault();
            
            const form = $('#ssc-feature-form');
            
            // Reset form
            SSC_Common.resetForm(form);
            
            // Scroll to form
            SSC_Common.scrollToForm(form);
        }
    };

})(jQuery);